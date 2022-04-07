import {Waku, WakuMessage} from "js-waku";

// export interface SocketEvents {
//     'ss-handshake': (offer: HandshakeSignal) => void
//     'ss-join': (maStr: string) => void
//     'ss-leave': (maStr: string) => void
//     'ws-peer': (maStr: string) => void
//     'ws-handshake': (offer: HandshakeSignal) => void
//     'error': (err: Error) => void
//     'listening': () => void
//     'close': () => void
// }

// TODO: Idea: a generic package that enables 2 peers to communicate over waku socket-style? might make sense with the
// addition of waku message version 2 (noise style).
export class WakuSocket {

    constructor(private waku: Waku) {
    }

    static async connect(): Promise<WakuSocket> {
        const waku = await Waku.create( {bootstrap: {default: true}} );

        return new WakuSocket(waku);
    }

    emit(ev: string, args: any) {
        const message = {
            message: args
        }

        WakuMessage.fromUtf8String(JSON.stringify(message), getContentTopic(ev)).then((wakuMsg) => this.waku.relay.send(wakuMsg))
        return this;
    }

    on(ev: string, listener: (event: any) => void) {
        this.waku.relay.addObserver((wakuMsg) => {
            const payload = wakuMsg.payloadAsUtf8
            if (!payload) return;

            const {message} = JSON.parse(payload);
            if (!message) return;

            listener(message)
        }, [getContentTopic(ev)])
    }

    once(ev: string, listener: (event: any) => void) {
        const observer = (wakuMsg: WakuMessage) => {
            const payload = wakuMsg.payloadAsUtf8
            if (!payload) return;

            const {message} = JSON.parse(payload);
            if (!message) return;

            listener(message)
            // Hacky "once", hopefully it works
            this.waku.relay.deleteObserver(observer, [getContentTopic(ev)])
        }
        this.waku.relay.addObserver(observer, [getContentTopic(ev)])
    }

    removeAllListeners() {
        this.waku.relay.observers = {};
    }

    listeners(ev: string) {
        return Array.from(this.waku.relay.observers[getContentTopic(ev)]).map(obs => {
            return (args: any ) => {
                const message = {
                    message: args
                }

                WakuMessage.fromUtf8String(JSON.stringify(message), getContentTopic(ev)).then((wakuMsg) =>
                    obs(wakuMsg)
                )
            }
        })
    }

}

/**
 * Return a content topic used for signaling purposes.
 *
 * It aims to mimick the behaviour of a signaling server. Most likely the design can be improved.
 *
 * @param event
 */
function getContentTopic(event: string): string {
    // TODO: Use protobuf
    return `/webrtc-signal/1/event/json`
}
