import type { Route                 } from "./+types/home"
import type { TelegramState         } from "~/telegram"
import      { useState, useEffect   } from "react"
import      { useOutletContext      } from "react-router"
import      { HugeiconsIcon         } from '@hugeicons/react'
import      { UserCircleIcon, QrCode01Icon, BookOpen01Icon, Loading03Icon, DashboardSpeed01Icon } from "@hugeicons/core-free-icons";

import UserProfile   from "../components/UserProfile";
import QRScanner     from "../components/QRScanner";
import Documentation from "../components/Documentation";
import DeviceSensors from "../components/DeviceSensors";





export function meta({ }: Route.MetaArgs) {

    return [

        { title: "React Telegram Miniapp" },
        { name: "description", content: "Welcome to Telegram Miniapp" },
    ];
}

export default function Home() {

    const tg = useOutletContext<TelegramState>()
    const [activeSection, setActiveSection] = useState<'profile' | 'scanner' | 'docs' | 'sensors'>('scanner');

    return (

        <div className="min-h-screen bg-gradient-to-b from-[#2d2d2d] via-[#3a3a3a] to-[#454545]">

            { tg.loading && <SessionValidationProgress />}

            <div className="pb-20">
                {activeSection === 'profile' && <UserProfile    tg={tg} /> }
                {activeSection === 'scanner' && <QRScanner      tg={tg} /> }
                {activeSection === 'sensors' && <DeviceSensors  tg={tg} /> }
                {activeSection === 'docs'    && <Documentation          /> }
            </div>

            <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#2a2a2a] shadow-lg pb-6">
                <div className="flex justify-around items-center h-16">

                    {
                        tg.session ? (

                            <button
                                onClick={() => setActiveSection('profile')}
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activeSection === 'profile'
                                        ? ''
                                        : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                {activeSection === 'profile' ? (
                                    <div className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] p-1 rounded-lg">
                                        <HugeiconsIcon
                                            icon={UserCircleIcon}
                                            size={24}
                                            strokeWidth={1.5}
                                            className="text-black"
                                        />
                                    </div>
                                ) : (
                                    <HugeiconsIcon
                                        icon={UserCircleIcon}
                                        size={24}
                                        strokeWidth={1.5}
                                    />
                                )}
                                <span className={`text-xs mt-1 ${activeSection === 'profile' ? 'bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent font-semibold' : ''}`}>Profile</span>
                            </button>

                        ) : (

                            <div className="flex flex-col items-center justify-center flex-1 h-full">
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-gray-400 animate-spin"
                                />
                                <span className="text-xs mt-1 text-gray-400">Loading</span>
                            </div>
                        )
                    }

                    <button
                        onClick={() => setActiveSection('scanner')}
                        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activeSection === 'scanner'
                                ? ''
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        {activeSection === 'scanner' ? (
                            <div className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] p-1 rounded-lg">                                
                                <HugeiconsIcon
                                    icon={QrCode01Icon}
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-black"
                                />
                            </div>
                        ) : (
                            <HugeiconsIcon
                                icon={QrCode01Icon}
                                size={24}
                                strokeWidth={1.5}
                            />
                        )}
                        <span className={`text-xs mt-1 ${activeSection === 'scanner' ? 'bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent font-semibold' : ''}`}>Scanner</span>
                    </button>

                    {
                        tg.session ? (

                            <button
                                onClick={() => setActiveSection('sensors')}
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activeSection === 'sensors'
                                        ? ''
                                        : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                {activeSection === 'sensors' ? (
                                    <div className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] p-1 rounded-lg">
                                        <HugeiconsIcon
                                            icon={DashboardSpeed01Icon}
                                            size={24}
                                            strokeWidth={1.5}
                                            className="text-black"
                                        />
                                    </div>
                                ) : (
                                    <HugeiconsIcon
                                        icon={DashboardSpeed01Icon}
                                        size={24}
                                        strokeWidth={1.5}
                                    />
                                )}
                                <span className={`text-xs mt-1 ${activeSection === 'sensors' ? 'bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent font-semibold' : ''}`}>Sensors</span>
                            </button>

                        ) : (

                            <div className="flex flex-col items-center justify-center flex-1 h-full">
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-gray-400 animate-spin"
                                />
                                <span className="text-xs mt-1 text-gray-400">Loading</span>
                            </div>
                        )
                    }

                    <button
                        onClick={() => setActiveSection('docs')}
                        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activeSection === 'docs'
                                ? ''
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        {activeSection === 'docs' ? (
                            <div className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] p-1 rounded-lg">                                
                                <HugeiconsIcon
                                    icon={BookOpen01Icon}
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-black"
                                />
                            </div>
                        ) : (
                            <HugeiconsIcon
                                icon={BookOpen01Icon}
                                size={24}
                                strokeWidth={1.5}
                            />
                        )}
                        <span className={`text-xs mt-1 ${activeSection === 'docs' ? 'bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent font-semibold' : ''}`}>Docs</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}





function SessionValidationProgress() {

    const expected_duration = 5
    const [t0] = useState(Date.now())
    const [duration, setDuration] = useState(0)

    useEffect(() => {

        const timer = setTimeout(() => {

            setDuration(Math.round((Date.now() - t0) / 1000))

        }, 1000)

        return () => clearTimeout(timer)

    }, [duration])

    if (duration > 0) {

        return <div className="fixed top-0 left-0 right-0 h-0.5 bg-[#1a1a1a] z-50">
            <div
                className="h-full bg-gradient-to-r from-[#ff9800] to-[#ffc107] transition-all duration-100 ease-linear"
                style={{ width: `${Math.round(100*duration/expected_duration)}%` }}
            />
            {/* <Text m="3" color="blue" style={{ opacity: "50%" }}>{`${duration} sec`}</Text> */}
        </div>
    }
}