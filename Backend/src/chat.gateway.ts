import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface User {
  id: string;
  socketId: string;
  isMatched: boolean;
  partnerId?: string;
}

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

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://vibe-call-frontend.vercel.app'], // Allow localhost and Vercel
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private waitingUsers: User[] = [];
  private connectedUsers: Map<string, User> = new Map();

  handleConnection(client: Socket) {
    console.log(`User connected: ${client.id} from ${client.handshake.headers.origin}`);
    
    const user: User = {
      id: client.id,
      socketId: client.id,
      isMatched: false,
    };
    
    this.connectedUsers.set(client.id, user);
    client.emit('user-id', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log(`User disconnected: ${client.id}`);
    
    const user = this.connectedUsers.get(client.id);
    if (user) {
      // Remove from waiting list if present
      this.waitingUsers = this.waitingUsers.filter(u => u.id !== client.id);
      
      // Notify partner if user was in a call
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

  @SubscribeMessage('find-partner')
  handleFindPartner(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user || user.isMatched) return;

    // Check if there's someone waiting
    if (this.waitingUsers.length > 0) {
      const partner = this.waitingUsers.shift()!;
      
      // Match the users
      user.isMatched = true;
      user.partnerId = partner.id;
      partner.isMatched = true;
      partner.partnerId = user.id;
      
      // Notify both users
      this.server.to(client.id).emit('partner-found', { partnerId: partner.id });
      this.server.to(partner.id).emit('partner-found', { partnerId: user.id });
      
      console.log(`Matched users: ${client.id} <-> ${partner.id}`);
    } else {
      // Add to waiting list
      this.waitingUsers.push(user);
      client.emit('waiting-for-partner');
      console.log(`User ${client.id} is waiting for a partner`);
    }
  }

  @SubscribeMessage('stop-searching')
  handleStopSearching(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;
    this.waitingUsers = this.waitingUsers.filter(u => u.id !== client.id);
    console.log(`User ${client.id} stopped searching`);
  }

  @SubscribeMessage('end-call')
  handleEndCall(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user || !user.isMatched) return;

    const partnerId = user.partnerId;
    const partner = this.connectedUsers.get(partnerId!);
    
    // Reset both users
    user.isMatched = false;
    user.partnerId = undefined;
    
    if (partner) {
      partner.isMatched = false;
      partner.partnerId = undefined;
      this.server.to(partnerId!).emit('call-ended');
      this.server.to(partnerId!).emit('partner-ended-call', {
        message: 'Your partner ended the call',
        timestamp: new Date().toISOString()
      });
    }
    
    client.emit('call-ended');
    console.log(`Call ended between: ${client.id} <-> ${partnerId}`);
  }

  @SubscribeMessage('next-partner')
  handleNextPartner(@ConnectedSocket() client: Socket) {
    this.handleEndCall(client);
    // Automatically find new partner
    setTimeout(() => {
      this.handleFindPartner(client);
    }, 100);
  }

  @SubscribeMessage('webrtc-signal')
  handleWebRTCSignal(@MessageBody() signal: WebRTCSignal, @ConnectedSocket() client: Socket) {
    // Relay WebRTC signals to the target user
    this.server.to(signal.targetUserId).emit('webrtc-signal', {
      type: signal.type,
      payload: signal.payload,
      fromUserId: client.id,
    });
  }

  @SubscribeMessage('chat-message')
  handleChatMessage(@MessageBody() message: ChatMessage, @ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user || !user.isMatched || !user.partnerId) return;

    // Add sender info and timestamp
    const messageWithMeta = {
      ...message,
      senderId: client.id,
      timestamp: new Date().toISOString(),
    };

    // Send message to partner
    this.server.to(user.partnerId).emit('chat-message', messageWithMeta);
    
    // Also send back to sender for their own message history
    client.emit('chat-message', messageWithMeta);
    
    console.log(`Message from ${client.id} to ${user.partnerId}: ${message.text}`);
  }
}
