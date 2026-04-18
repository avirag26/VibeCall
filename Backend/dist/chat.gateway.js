"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let ChatGateway = class ChatGateway {
    constructor() {
        this.waitingUsers = [];
        this.connectedUsers = new Map();
    }
    handleConnection(client) {
        console.log(`User connected: ${client.id} from ${client.handshake.headers.origin}`);
        const user = {
            id: client.id,
            socketId: client.id,
            isMatched: false,
        };
        this.connectedUsers.set(client.id, user);
        client.emit('user-id', client.id);
    }
    handleDisconnect(client) {
        console.log(`User disconnected: ${client.id}`);
        const user = this.connectedUsers.get(client.id);
        if (user) {
            this.waitingUsers = this.waitingUsers.filter(u => u.id !== client.id);
            if (user.isMatched && user.partnerId) {
                const partner = this.connectedUsers.get(user.partnerId);
                if (partner) {
                    partner.isMatched = false;
                    partner.partnerId = undefined;
                    this.server.to(user.partnerId).emit('partner-disconnected');
                }
            }
            this.connectedUsers.delete(client.id);
        }
    }
    handleFindPartner(client) {
        const user = this.connectedUsers.get(client.id);
        if (!user || user.isMatched)
            return;
        if (this.waitingUsers.length > 0) {
            const partner = this.waitingUsers.shift();
            user.isMatched = true;
            user.partnerId = partner.id;
            partner.isMatched = true;
            partner.partnerId = user.id;
            this.server.to(client.id).emit('partner-found', { partnerId: partner.id });
            this.server.to(partner.id).emit('partner-found', { partnerId: user.id });
            console.log(`Matched users: ${client.id} <-> ${partner.id}`);
        }
        else {
            this.waitingUsers.push(user);
            client.emit('waiting-for-partner');
            console.log(`User ${client.id} is waiting for a partner`);
        }
    }
    handleEndCall(client) {
        const user = this.connectedUsers.get(client.id);
        if (!user || !user.isMatched)
            return;
        const partnerId = user.partnerId;
        const partner = this.connectedUsers.get(partnerId);
        user.isMatched = false;
        user.partnerId = undefined;
        if (partner) {
            partner.isMatched = false;
            partner.partnerId = undefined;
            this.server.to(partnerId).emit('call-ended');
            this.server.to(partnerId).emit('partner-ended-call', {
                message: 'Your partner ended the call',
                timestamp: new Date().toISOString()
            });
        }
        client.emit('call-ended');
        console.log(`Call ended between: ${client.id} <-> ${partnerId}`);
    }
    handleNextPartner(client) {
        this.handleEndCall(client);
        setTimeout(() => {
            this.handleFindPartner(client);
        }, 100);
    }
    handleWebRTCSignal(signal, client) {
        this.server.to(signal.targetUserId).emit('webrtc-signal', {
            type: signal.type,
            payload: signal.payload,
            fromUserId: client.id,
        });
    }
    handleChatMessage(message, client) {
        const user = this.connectedUsers.get(client.id);
        if (!user || !user.isMatched || !user.partnerId)
            return;
        const messageWithMeta = {
            ...message,
            senderId: client.id,
            timestamp: new Date().toISOString(),
        };
        this.server.to(user.partnerId).emit('chat-message', messageWithMeta);
        client.emit('chat-message', messageWithMeta);
        console.log(`Message from ${client.id} to ${user.partnerId}: ${message.text}`);
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('find-partner'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleFindPartner", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('end-call'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleEndCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('next-partner'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleNextPartner", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('webrtc-signal'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleWebRTCSignal", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('chat-message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleChatMessage", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: ['http://localhost:3000'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
    })
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map