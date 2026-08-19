'use client';

import { useEffect, useRef } from 'react';

/**
 * Realtime events pushed by the backend timetable realtime controller.
 * Every payload carries a `type` field naming the event; additional fields
 * are event-specific (generationId, scheduleId, lockOwner, day, ...).
 */
export interface TimetableRealtimeEvent {
  type: string;
  lobbyId?: string;
  generationId?: string;
  termId?: string;
  mode?: string;
  scheduleId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  lockOwner?: string | null;
  expiresAt?: string | null;
  day?: number | null;
  period?: number | null;
  requirementId?: string;
  courseId?: string;
  courseCode?: string;
  groupId?: string;
  [key: string]: unknown;
}

export const TIMETABLE_REALTIME_EVENTS = {
  MANAGEMENT_STARTED: 'TIMETABLE_MANAGEMENT_STARTED',
  LOBBY_CANCELLED: 'LOBBY_CANCELLED',
  LOBBY_MEMBER_JOINED: 'LOBBY_MEMBER_JOINED',
  GENERATION_COMPLETED: 'GENERATION_COMPLETED',
  GENERATION_STARTED: 'GENERATION_STARTED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  SCHEDULE_CREATED: 'SCHEDULE_CREATED',
  SCHEDULE_UPDATED: 'SCHEDULE_UPDATED',
  SCHEDULE_DELETED: 'SCHEDULE_DELETED',
  SCHEDULE_LOCKED: 'SCHEDULE_LOCKED',
  SCHEDULE_UNLOCKED: 'SCHEDULE_UNLOCKED',
  DRAG_STARTED: 'DRAG_STARTED',
  DRAG_MOVED: 'DRAG_MOVED',
  DRAG_ENDED: 'DRAG_ENDED',
  TIMETABLE_PUBLISHED: 'TIMETABLE_PUBLISHED',
  TIMETABLE_DELETED: 'TIMETABLE_DELETED',
  COURSE_REQUIREMENT_CREATED: 'COURSE_REQUIREMENT_CREATED',
  COURSE_REQUIREMENT_UPDATED: 'COURSE_REQUIREMENT_UPDATED',
  COURSE_REQUIREMENT_DELETED: 'COURSE_REQUIREMENT_DELETED',
  TEACHING_GROUP_CREATED: 'TEACHING_GROUP_CREATED',
  TEACHING_GROUP_DELETED: 'TEACHING_GROUP_DELETED',
} as const;

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

function streamUrl(lobbyId: string): string {
  return `/api/backend/api/realtime/lobbies/${encodeURIComponent(lobbyId)}/stream`;
}

/**
 * SSE subscription to a timetable generation lobby.
 *
 * The backend relays events only to verified lobby members, so the stream
 * itself doubles as a membership check: a non-member gets a non-2xx response
 * and the hook stops retrying until the lobby changes.
 */
export function useTimetableRealtime(
  lobbyId: string | null | undefined,
  onEvent: (event: TimetableRealtimeEvent) => void,
): void {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!lobbyId) return;

    let source: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const open = () => {
      if (closed) return;
      source = new EventSource(streamUrl(lobbyId));

      source.onopen = () => {
        attempt = 0;
      };

      source.onmessage = (msg) => {
        if (closed || !msg.data) return;
        try {
          const event = JSON.parse(msg.data) as TimetableRealtimeEvent;
          if (event && typeof event.type === 'string') {
            onEventRef.current(event);
          }
        } catch {
          // Ignore malformed payloads; full state is re-fetched on reconnect.
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        attempt += 1;
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
        reconnectTimer = setTimeout(open, delay);
      };
    };

    open();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      source = null;
    };
  }, [lobbyId]);
}