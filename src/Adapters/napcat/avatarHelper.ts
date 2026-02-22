// src/Adapters/napcat/avatarHelper.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.

export function getAvatarUrl(chatType: number, id: string): string {
    global.logger.log(`[getAvatarUrl] chatType: ${chatType} id: ${id}`);

    if (chatType === 1) {
        return `http://q1.qlogo.cn/g?b=qq&nk=${id}&s=100`;
    }
    return `https://p.qlogo.cn/gh/${id}/${id}/100`;
}