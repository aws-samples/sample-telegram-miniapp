export function message(err: any): string {

    try {

        if (err) {

            if (typeof err === 'string') {

                return err
            }

            if (typeof err === 'object') {

                if (err instanceof Error) {

                    if (typeof err.message === 'string') {

                        return err.message
                    }
                }
            }

            /*
            if (err['toString'] && typeof err['toString'] === 'function') {

                const str = err.toString()

                if (typeof str === 'string') {

                    return str
                }
            }
            */

            return typeof err === 'object' ? JSON.stringify(err) : `${err}`
        }

        return ''
    }

    catch {

        return ''
    }
}