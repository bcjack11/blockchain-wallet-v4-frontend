import {PEER_MESSAGE, SOCKET_OPENED} from '../tcprelay/actionTypes'
import { CONNECT, DISCONNECT, INIT_MESSAGE_RECEIVED, SEND_MESSAGE } from './actionTypes'
import { peerStaticRemote, privateKeyPath} from './selectors'
import { takeEvery, delay} from 'redux-saga'
import { call, put, select, take } from 'redux-saga/effects'
import {Connection} from './connection'
import { connected, updateLastPing, initMessageReceived, disconnected} from './actions'
import { wrapPubKey } from '../helper.js'
import {readMessage, writeMessage} from '../messages/parser'
import TYPE from '../messages/types'
import * as AT_CHANNEL from '../channel/actions'
import { rootOptions } from '../root/selectors'

var ec = require('bcoin/lib/crypto/secp256k1-browser')

export const encodePeer = pubKey => pubKey.toString('base64')
export const decodePeer = pubKey => Buffer.from(pubKey, 'base64')

export const peerSagas = (tcpConn) => {
  let peers = {}

  const connectToAllPeers = function * (action) {
    console.log('socket opened')
    let staticRemotes = yield select(peerStaticRemote)

    for (let staticRemoteString in staticRemotes) {
      yield call(connect, {type: CONNECT, pubKey: staticRemoteString})
    }
  }

  const connect = function * (action) {
    let {type, pubKey} = action
    console.log(type)
    console.log(pubKey)
    let staticRemote = wrapPubKey(Buffer.from(pubKey, 'hex'))
    let options = yield select(rootOptions)
    let peer = new Connection(options, staticRemote)
    if (peers[pubKey] !== undefined) {
      console.info('already exists...')
      return
    }

    peers[pubKey] = peer
    yield call(peer.connectPromise.bind(peer), tcpConn)
    yield put(connected(pubKey))
    let initMessageAction = {}
    while (pubKey !== initMessageAction.pubKey) {
      initMessageAction = yield take(INIT_MESSAGE_RECEIVED)
    }
    console.info('done!!! connected ')
  }

  const onMessage = function * ({peer, msg}) {
    let pubKey = decodePeer(peer).toString('hex')

    if (peers[pubKey] === undefined) {
      console.info('No handler for message')
      return
    }

    let conn = peers[pubKey]
    let decryptedMsg = conn.feed(msg)
    if (decryptedMsg === undefined) {
      return
    }

    let parsedMsg = readMessage(decryptedMsg)
    console.info('[<-] ' + TYPE.extractName(parsedMsg.type) + ': ', parsedMsg)

    if (parsedMsg.type === 16) {
      conn.gfRemote = parsedMsg.gf
      conn.lfRemote = parsedMsg.lf
      yield put(initMessageReceived(pubKey))
      return
    }

    if (parsedMsg.type === 17) {
      console.info('received error message ' + parsedMsg.data.toString('ascii'))
      // TODO should throw an error or something here..
      return
    }

    if (parsedMsg.type === 18) {
      console.info('received ping message')
      yield put(updateLastPing(pubKey))
      return
    }

    yield put(AT_CHANNEL.onMessage(pubKey, parsedMsg))
  }

  const disconnect = function * (action) {
    let {type, pubKey} = action
    if (peers[pubKey] === undefined) {
      console.info('nothing to disconnect')
      return
    }

    delete peers[pubKey]
    yield put(disconnected(pubKey))
  }

  const sendMessage = function * (action) {
    let {pubKey, message} = action
    console.info('[->] ' + TYPE.extractName(message.type) + ': ', message)
    let connection = peers[pubKey.toString('hex')]
    connection.write(writeMessage(message))
  }

  const takeSagas = function * () {
    yield takeEvery(CONNECT, connect)
    yield takeEvery(DISCONNECT, disconnect)
    yield takeEvery(PEER_MESSAGE, onMessage)
    yield takeEvery(SEND_MESSAGE, sendMessage)
  }

  return {
    connectToAllPeers,
    connect,
    disconnect,
    sendMessage,
    takeSagas
  }
}