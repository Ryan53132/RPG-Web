export const isGm = (room, pid) => room.gmId === pid;
export const canControl = (room, pid, token) => isGm(room, pid) || token.owner === pid;
