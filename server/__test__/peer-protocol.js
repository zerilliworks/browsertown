"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = __importDefault(require("ava"));
const axios_1 = __importDefault(require("axios"));
const server_1 = require("../server");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const test = ava_1.default;
test.before('start a server instance to test', t => {
    return new Promise((resolve, reject) => {
        let server = server_1.startServer();
        server.once('listening', () => {
            t.context.serverUrl = `http://localhost:${server.address().port}`;
            t.context.serverPort = server.address().port;
            t.context.axios = axios_1.default.create({ baseURL: t.context.serverUrl });
            resolve();
        });
    });
});
test.beforeEach('create a socket connection', t => {
    t.context.socket = socket_io_client_1.default(t.context.serverUrl, { forceNew: true });
});
test.afterEach('disconnect from socket', t => {
    t.context.socket.close();
});
test.after.always('cleanup server instance', () => {
    server_1.http.close();
});
// Tests themselves
test.cb('can connect to socket', (t) => {
    t.context.socket.emit('heartbeat', 'lub', (re) => {
        t.is(re, 'dub');
        t.end();
    });
});
