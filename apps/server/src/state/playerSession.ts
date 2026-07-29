import type { WebSocket } from "ws";
import type { PlayerInfo, ServerMessage } from "@blockforge/shared";

export interface PlayerSession {
  id: string;
  nickname: string;
  socket: WebSocket;
  position: readonly [number, number, number];
  yaw: number;
  pitch: number;
}

export function toPlayerInfo(session: PlayerSession): PlayerInfo {
  return { id: session.id, nickname: session.nickname, position: session.position, yaw: session.yaw, pitch: session.pitch };
}

/** Tracks connected players and handles fan-out to sockets. */
export class SessionRegistry {
  private readonly sessions = new Map<string, PlayerSession>();

  add(session: PlayerSession): void {
    this.sessions.set(session.id, session);
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  all(): PlayerSession[] {
    return [...this.sessions.values()];
  }

  send(session: PlayerSession, message: ServerMessage): void {
    if (session.socket.readyState === session.socket.OPEN) {
      session.socket.send(JSON.stringify(message));
    }
  }

  broadcast(message: ServerMessage, exceptId?: string): void {
    const payload = JSON.stringify(message);
    for (const session of this.sessions.values()) {
      if (session.id === exceptId) continue;
      if (session.socket.readyState === session.socket.OPEN) session.socket.send(payload);
    }
  }
}
