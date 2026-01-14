import type { TelegramState } from "~/telegram"
import { useState, useEffect } from 'react';
import { hapticFeedback, postEvent } from "@tma.js/sdk-react"





interface DeviceOrientationData {

    alpha: number | null;
    beta: number | null;
    gamma: number | null;
}

interface GeolocationData {

    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
}

function DeviceSensors({ tg } : { tg: TelegramState }) {

    const [orientation, setOrientation] = useState<DeviceOrientationData>({

        alpha: null,
        beta: null,
        gamma: null,
    })

    const [location, setLocation] = useState<GeolocationData>({

        latitude: null,
        longitude: null,
        accuracy: null,
    })

    const [sensorSupported, setSensorSupported] = useState(false)
    const [shakeCount, setShakeCount] = useState(0)
    const [lastShakeTime, setLastShakeTime] = useState(0)

    const [normalizedAlpha, setNormalizedAlpha] = useState(0)
    const [normalizedBeta, setNormalizedBeta] = useState(0)
    const [normalizedGamma, setNormalizedGamma] = useState(0)
    
    const normalizeAngle = (newAngle: number | null, previousNormalized: number): number => {

        if (newAngle === null) return previousNormalized;
        
        const diff = newAngle - (previousNormalized % 360);

        let normalizedDiff = diff;

        if (normalizedDiff > 180) {

            normalizedDiff -= 360;
        }
        else if (normalizedDiff < -180) {

            normalizedDiff += 360;
        }

        return previousNormalized + normalizedDiff;
    };

    useEffect(() => {

        const handleOrientation = (event: DeviceOrientationEvent) => {

            setSensorSupported(true)

            setOrientation({

                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma,
            })

            setNormalizedAlpha(prev => normalizeAngle(event.alpha, prev))
            setNormalizedBeta(prev => normalizeAngle(event.beta, prev))
            setNormalizedGamma(prev => normalizeAngle(event.gamma, prev))
        };

        const handleMotion = (event: DeviceMotionEvent) => {

            if (event.accelerationIncludingGravity) {

                const x = event.accelerationIncludingGravity.x || 0
                const y = event.accelerationIncludingGravity.y || 0
                const z = event.accelerationIncludingGravity.z || 0

                // Shake Detector: Calculate total acceleration magnitude
                const acceleration = Math.sqrt(x * x + y * y + z * z)
                const SHAKE_THRESHOLD = 25 // Sensitivity threshold
                const SHAKE_TIMEOUT = 500 // Minimum time between shakes (ms)

                const now = Date.now()
                if (acceleration > SHAKE_THRESHOLD && (now - lastShakeTime) > SHAKE_TIMEOUT) {
                    setLastShakeTime(now)
                    setShakeCount(prev => prev + 1)
                    hapticFeedback.impactOccurred('heavy')
                }
            }
        };

        const requestPermission = async () => {

            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {

                try {

                    const permission = await (DeviceOrientationEvent as any).requestPermission();

                    if (permission === 'granted') {

                        window.addEventListener('deviceorientation', handleOrientation);
                        window.addEventListener('devicemotion', handleMotion);
                    }
                }

                catch (error) {

                    console.error('Permission denied:', error);
                }

            }

            else {

                window.addEventListener('deviceorientation', handleOrientation);
                window.addEventListener('devicemotion', handleMotion);
            }
        };

        postEvent('web_app_start_gyroscope', {

            refresh_rate: 60
        });

        requestPermission();

        if (navigator.geolocation) {

            const watchId = navigator.geolocation.watchPosition(

                (position) => {

                    setLocation({

                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    })
                },
                (error) => {

                    console.error('Geolocation error:', error)
                },
                { enableHighAccuracy: true, maximumAge: 10000 }
            )

            return () => {

                postEvent('web_app_stop_gyroscope')
                window.removeEventListener('deviceorientation', handleOrientation);
                window.removeEventListener('devicemotion', handleMotion);
                navigator.geolocation.clearWatch(watchId)
            };
        }

        return () => {

            postEvent('web_app_stop_gyroscope')
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);
        };

    }, [])

    // Haptic Pattern Functions
    const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid') => {
        hapticFeedback.impactOccurred(type)
    }

    const triggerNotification = (type: 'error' | 'success' | 'warning') => {
        hapticFeedback.notificationOccurred(type)
    }

    return (

        <div className="p-6 pt-8 bg-gradient-to-br from-[#2d2d2d] via-[#3a3a3a] to-[#454545]">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Device Sensors</h1>
            </div>

            {/* Shake Counter */}
            {shakeCount > 0 && (
                <div className="bg-orange-900/30 border border-orange-600/50 rounded-lg p-4 mb-4">
                    <p className="text-orange-200 text-sm font-semibold">
                        Shakes detected: {shakeCount}
                    </p>
                </div>
            )}

            <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-[#2a2a2a] overflow-hidden p-6">
                {!sensorSupported && (
                    <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-4">
                        <p className="text-yellow-200 text-sm">
                            Sensor data not available. Tilt or move your device to activate sensors.
                        </p>
                    </div>
                )}

                {/* 3D Cube */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Gyroscope</h3>
                    <div className="flex justify-center mb-4">
                        <div className="relative w-64 h-64" style={{ perspective: '800px' }}>
                            <div
                                className="w-full h-full"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: `
                                        rotateZ(${normalizedAlpha}deg)
                                        rotateX(${normalizedBeta}deg)
                                        rotateY(${normalizedGamma}deg)
                                    `,
                                    transition: 'transform 0.1s ease-out',
                                }}
                            >
                                {/* Front face */}
                                <div
                                    className="absolute w-32 h-32 flex items-center justify-center border-2 border-orange-500 bg-orange-900/30"
                                    style={{
                                        transform: 'translateZ(64px)',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-64px',
                                        marginTop: '-64px',
                                    }}
                                >
                                    <span className="text-orange-400 font-bold text-xl">FRONT</span>
                                </div>

                                {/* Back face */}
                                <div
                                    className="absolute w-32 h-32 flex items-center justify-center border-2 border-blue-500 bg-blue-900/30"
                                    style={{
                                        transform: 'translateZ(-64px) rotateY(180deg)',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-64px',
                                        marginTop: '-64px',
                                    }}
                                >
                                    <span className="text-blue-400 font-bold text-xl">BACK</span>
                                </div>

                                {/* Left face */}
                                <div
                                    className="absolute w-32 h-32 flex items-center justify-center border-2 border-green-500 bg-green-900/30"
                                    style={{
                                        transform: 'rotateY(-90deg) translateZ(64px)',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-64px',
                                        marginTop: '-64px',
                                    }}
                                >
                                    <span className="text-green-400 font-bold text-xl">LEFT</span>
                                </div>

                                {/* Right face */}
                                <div
                                    className="absolute w-32 h-32 flex items-center justify-center border-2 border-purple-500 bg-purple-900/30"
                                    style={{
                                        transform: 'rotateY(90deg) translateZ(64px)',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-64px',
                                        marginTop: '-64px',
                                    }}
                                >
                                    <span className="text-purple-400 font-bold text-xl">RIGHT</span>
                                </div>

                                {/* Top face */}
                                <div
                                    className="absolute w-32 h-32 flex items-center justify-center border-2 border-yellow-500 bg-yellow-900/30"
                                    style={{
                                        transform: 'rotateX(90deg) translateZ(64px)',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-64px',
                                        marginTop: '-64px',
                                    }}
                                >
                                    <span className="text-yellow-400 font-bold text-xl">TOP</span>
                                </div>

                                {/* Bottom face */}
                                <div
                                    className="absolute w-32 h-32 flex items-center justify-center border-2 border-red-500 bg-red-900/30"
                                    style={{
                                        transform: 'rotateX(-90deg) translateZ(64px)',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-64px',
                                        marginTop: '-64px',
                                    }}
                                >
                                    <span className="text-red-400 font-bold text-xl">BOTTOM</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-center text-gray-400 text-sm">
                        Rotate your device to see the cube stay stable in space
                    </div>
                </div>

                {/* Orientation Data */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Orientation</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#2a2a2a] rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Alpha (α)</p>
                            <p className="text-white font-bold text-lg">
                                {orientation.alpha !== null ? `${orientation.alpha.toFixed(1)}°` : '--'}
                            </p>
                        </div>
                        <div className="bg-[#2a2a2a] rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Beta (β)</p>
                            <p className="text-white font-bold text-lg">
                                {orientation.beta !== null ? `${orientation.beta.toFixed(1)}°` : '--'}
                            </p>
                        </div>
                        <div className="bg-[#2a2a2a] rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Gamma (γ)</p>
                            <p className="text-white font-bold text-lg">
                                {orientation.gamma !== null ? `${orientation.gamma.toFixed(1)}°` : '--'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* GPS Location Display */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">GPS Location</h3>
                    <div className="bg-[#2a2a2a] rounded-lg p-4">
                        {location.latitude !== null ? (
                            <div className="space-y-1">
                                <p className="text-gray-300 text-sm">
                                    <span className="text-gray-400">Lat:</span> {location.latitude.toFixed(6)}°
                                </p>
                                <p className="text-gray-300 text-sm">
                                    <span className="text-gray-400">Lng:</span> {location.longitude?.toFixed(6)}°
                                </p>
                                <p className="text-gray-400 text-xs mt-2">
                                    Accuracy: ±{location.accuracy?.toFixed(0)}m
                                </p>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">Waiting for GPS...</p>
                        )}
                    </div>
                </div>

                {/* Haptic Feedback Controls */}
                <div className="pt-6 border-t border-[#2a2a2a]">
                    <h3 className="text-lg font-semibold text-white mb-3">Haptic Feedback</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-gray-400 text-sm mb-2">Impact Patterns</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => triggerHaptic('light')}
                                    className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm transition-colors"
                                >
                                    Light
                                </button>
                                <button
                                    onClick={() => triggerHaptic('medium')}
                                    className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm transition-colors"
                                >
                                    Medium
                                </button>
                                <button
                                    onClick={() => triggerHaptic('heavy')}
                                    className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm transition-colors"
                                >
                                    Heavy
                                </button>
                                <button
                                    onClick={() => triggerHaptic('soft')}
                                    className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm transition-colors"
                                >
                                    Soft
                                </button>
                                <button
                                    onClick={() => triggerHaptic('rigid')}
                                    className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm transition-colors"
                                >
                                    Rigid
                                </button>
                            </div>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm mb-2">Notification Patterns</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => triggerNotification('success')}
                                    className="px-4 py-2 bg-green-900/30 hover:bg-green-800/40 text-green-200 rounded-lg text-sm transition-colors border border-green-700/50"
                                >
                                    Success
                                </button>
                                <button
                                    onClick={() => triggerNotification('warning')}
                                    className="px-4 py-2 bg-yellow-900/30 hover:bg-yellow-800/40 text-yellow-200 rounded-lg text-sm transition-colors border border-yellow-700/50"
                                >
                                    Warning
                                </button>
                                <button
                                    onClick={() => triggerNotification('error')}
                                    className="px-4 py-2 bg-red-900/30 hover:bg-red-800/40 text-red-200 rounded-lg text-sm transition-colors border border-red-700/50"
                                >
                                    Error
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeviceSensors