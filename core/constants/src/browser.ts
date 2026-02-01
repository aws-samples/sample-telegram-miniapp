// Browser-safe constants only
// DO NOT add sensitive configuration here (AWS accounts, secrets, internal paths, etc.)

 /**
 * Browser-safe constants
 * These values are safe to expose in client-side code
 */
export const browser = {

    session: {

        headers: {

            bodyHash: "X-Amz-Content-SHA256"
        }
    }

} as const