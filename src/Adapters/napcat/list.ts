// src/Adapters/napcat/list.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.

import { sendNapCatPostRequest } from "./request";

export async function getRecentContact(count: Number): Promise<any> {
    try{
        return (await sendNapCatPostRequest("/get_recent_contact", {
            count: count
        }));
    }
    catch(err){
        throw err;
    }
    
}