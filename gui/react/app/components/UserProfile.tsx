import type { TelegramState     } from "~/telegram"
import type { HomeScreenStatus  } from "@tma.js/sdk-react"
import { HugeiconsIcon          } from '@hugeicons/react'
import { UserCircleIcon         } from "@hugeicons/core-free-icons"
import { useEffect, useState    } from "react"
import { checkHomeScreenStatus,
         addToHomeScreen        } from "@tma.js/sdk-react"





function UserProfile({ tg } : { tg: TelegramState }) {

    const user = tg.session
    const [ addHomeStatus, setHomeStatus ] = useState<HomeScreenStatus|undefined>(undefined)

    useEffect(() => {

        checkHomeScreenStatus().then(setHomeStatus)

    }, [])

    return (
        <div className="p-6 pt-8">
            <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>

            <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-[#2a2a2a] overflow-hidden">
                <div className="h-20 bg-gradient-to-br from-[#ff9800] to-[#ffc107]"></div>

                <div className="relative px-6 pb-6">
                    <div className="absolute -top-12 left-6">
                        <div className="w-24 h-24 rounded-full bg-[#2a2a2a] border-4 border-[#1a1a1a] flex items-center justify-center shadow-lg">
                            { user?.photo_url ? (
                                <img
                                    src={ user?.photo_url }
                                    alt={ user?.name }
                                    className="w-full h-full rounded-full object-cover"
                                />
                            ) : (
                                <div className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] p-2 rounded-full">
                                    <HugeiconsIcon
                                        icon={UserCircleIcon}
                                        size={40}
                                        strokeWidth={1.5}
                                        className="text-black"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-16">
                        <h2 className="text-2xl font-bold text-white mb-1">
                            { user?.name }
                        </h2>
                        <p className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent text-lg mb-4 font-semibold">{user?.username}</p>

                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#2a2a2a]">
                            <div className="flex-1">
                                <p className="text-gray-400 text-sm">Language</p>
                                <p className="text-white font-medium">{user?.language_code}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6">

                { addHomeStatus === 'unsupported'
                    ?   <div className="mt-4 border rounded-lg p-4">
                            Unfortunately, the "Add to Home Screen" functionality is not supported on this device.
                        </div>
                    : <button
                        disabled    ={!tg.session }
                        onClick     ={ addToHomeScreen }
                        className   = "w-full bg-gradient-to-r from-[#ff9800] to-[#ffc107] text-black font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
                    >
                        Add me to Home Screen!
                    </button>
                }

            </div>

        </div>
    );
}

export default UserProfile;