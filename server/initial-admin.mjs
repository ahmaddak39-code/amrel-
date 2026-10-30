// Одноразовый начальный пароль администратора — только усиленный scrypt-хеш (N=131072), не сам пароль.
// Действует, пока владелец не сменит пароль: при первом входе панель требует новый пароль,
// после смены этот хеш больше никогда не принимается.
export const INITIAL_ADMIN_HASH = 'scrypt:131072:8:1:WOFzzqCIrJ+f9B+nKvEn7g==:lXTamDrSHmqK26x165s9eezVNoa1V54o+ZX0sReJEDENYxXCpvopjKzg2CGOutwuvzbgBaCln+YkrSoDclP9LA==';
