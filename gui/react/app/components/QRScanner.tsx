import type { TelegramState } from "~/telegram"
import { useState       } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon,
         Copy01Icon     } from "@hugeicons/core-free-icons";
import { hapticFeedback, qrScanner } from "@tma.js/sdk-react";





interface ScanResult {
    id: string;
    text: string;
    timestamp: Date;
}

function QRScanner({ tg } : { tg: TelegramState }) {

    const [scanResults, setScanResults] = useState<ScanResult[]>([]);

    const handleScan = () => {

        qrScanner.open({

            onCaptured: text => {

                setScanResults([{ id: scanResults.length.toFixed(), text, timestamp: new Date() }, ...scanResults])
                hapticFeedback.notificationOccurred("success")
                qrScanner.close()
            }
        })
    };

    const clearResults = () => {

        setScanResults([]);
    };

    const copyToClipboard = (text: string) => {

        if (navigator.clipboard) {

            navigator.clipboard.writeText(text).then(() => {
                hapticFeedback.notificationOccurred("success")
            }).catch((err) => {
                console.error('Failed to copy to clipboard:', err);
                hapticFeedback.notificationOccurred("error")
            });
        }
    };

    const formatTime = (date: Date) => {

        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="p-6 pt-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">QR Scanner</h1>
                {scanResults.length > 0 && (
                    <button
                        onClick={clearResults}
                        className="text-gray-400 hover:bg-gradient-to-r hover:from-[#ff9800] hover:to-[#ffc107] hover:bg-clip-text hover:text-transparent transition-colors"
                    >
                        <HugeiconsIcon
                            icon={Delete02Icon}
                            size={20}
                            strokeWidth={1.5}
                        />
                    </button>
                )}
            </div>

            {/* Scanner Area */}
            <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden mb-6">
                <div className="bg-black flex items-center justify-center p-8">
                    {/* QR Code */}
                    <img
                        src="/qrcode.svg"
                        alt="QR Code"
                        className="w-32 h-32"
                    />
                </div>

                {/* Scan Button */}
                <div className="p-6">
                    <button
                        onClick={handleScan}
                        className="w-full bg-gradient-to-br from-[#ff9800] to-[#ffc107] text-black font-bold py-4 rounded-lg hover:shadow-lg hover:shadow-[#ffc107]/50 transition-all active:scale-95"
                    >
                        Start Scanning
                    </button>
                </div>
            </div>

            {/* Scan Results */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Recent Scans</h2>

                {scanResults.length === 0 ? (
                    <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-8 text-center">
                        <p className="text-gray-400">No scans yet</p>
                        <p className="text-gray-500 text-sm mt-1">Start scanning to see results here</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {scanResults.map((result) => (
                            <div
                                key={result.id}
                                className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-4 hover:border-[#ffc107] transition-colors"
                            >
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-mono text-sm break-all mb-2">
                                            {result.text}
                                        </p>
                                        <p className="text-gray-400 text-xs">{formatTime(result.timestamp)}</p>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(result.text)}
                                        className="flex-shrink-0 text-gray-400 hover:text-[#ffc107] transition-colors p-1"
                                        title="Copy to clipboard"
                                    >
                                        <HugeiconsIcon
                                            icon={Copy01Icon}
                                            size={18}
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default QRScanner;