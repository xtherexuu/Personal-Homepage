"use client";

import { useEffect, useRef } from "react";

import { markRead } from "@/app/admin/actions";

/**
 * Fires setRead(id) once after the detail page MOUNTS — a deliberate POST, not
 * a render side-effect, so a <Link> prefetch of the page can never mark a
 * message read by merely hovering it. Rendered only while the message is
 * unread; marking a message unread again navigates back to the inbox
 * (message-actions.tsx), so this never re-fires against the admin's intent.
 */
export function MarkRead({ id }: { id: number }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void markRead(id);
  }, [id]);

  return null;
}
