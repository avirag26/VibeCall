import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
interface WebRTCSignal {
    type: 'offer' | 'answer' | 'ice-candidate';
    payload: any;
    targetUserId: string;
}
interface ChatMessage {
    text: string;
    senderId: string;
    timestamp: string;
}
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private waitingUsers;
    private connectedUsers;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleFindPartner(client: Socket): void;
    handleEndCall(client: Socket): void;
    handleNextPartner(client: Socket): void;
    handleWebRTCSignal(signal: WebRTCSignal, client: Socket): void;
    handleChatMessage(message: ChatMessage, client: Socket): void;
}
export {};
