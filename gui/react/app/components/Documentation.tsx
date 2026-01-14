import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";





type Framework = 'react' | 'sveltekit';

interface CodeExample {
    title: string;
    description: string;
    code: string;
}

function Documentation() {
    const [activeFramework, setActiveFramework] = useState<Framework>('react');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const reactExamples: CodeExample[] = [
        {
            title: 'Installation',
            description: 'Install dependencies for the entire monorepo',
            code: `pnpm install`,
        },
        {
            title: 'Local Development',
            description: 'Start the React Router v7 dev server with hot reload',
            code: `cd gui/react
pnpm dev
# Starts on http://localhost:5173`,
        },
        {
            title: 'Type Checking',
            description: 'Generate types and run TypeScript compiler',
            code: `cd gui/react
pnpm typecheck`,
        },
        {
            title: 'Build for Production',
            description: 'Build the React app for deployment',
            code: `cd gui/react
pnpm build`,
        },
        {
            title: 'Configure Frontend',
            description: 'Set React as the frontend in app.yaml',
            code: `app:
  name: MiniApp
  frontend: gui/react  # Choose React Router v7
  firewall: true`,
        },
        {
            title: 'Deploy to AWS',
            description: 'Build all packages and deploy via CDK',
            code: `# Build all packages
pnpm run -r build

# Deploy CDK stacks
cd infra/cdk
pnpm run deploy`,
        },
        {
            title: 'Telegram WebApp Hook',
            description: 'Using the Telegram context in React components',
            code: `import { useOutletContext } from 'react-router'
import type { TelegramState } from '~/auth/telegram'

function MyComponent() {
  const { webapp, session } = useOutletContext<TelegramState>()

  const handleClick = () => {
    webapp?.HapticFeedback.impactOccurred('medium')
  }

  return <button onClick={handleClick}>Click me</button>
}`,
        },
    ];

    const sveltekitExamples: CodeExample[] = [
        {
            title: 'Installation',
            description: 'Install dependencies for the entire monorepo',
            code: `pnpm install`,
        },
        {
            title: 'Local Development',
            description: 'Start the SvelteKit v5 dev server with hot reload',
            code: `cd gui/svelte
pnpm dev
# Starts on http://localhost:5173`,
        },
        {
            title: 'Configure Frontend',
            description: 'Set SvelteKit as the frontend in app.yaml',
            code: `app:
  name: MiniApp
  frontend: gui/svelte  # Choose SvelteKit v5
  firewall: true`,
        },
        {
            title: 'Deploy to AWS',
            description: 'Build all packages and deploy via CDK',
            code: `# Bootstrap CDK into your region of choice (if needed; during the very first CDK deployment)
pnpm run bootstrap
# Deploy CDK stacks
pnpm run deploy`,
        },
        {
            title: 'Telegram WebApp Store',
            description: 'Using Telegram store in Svelte components',
            code: `<script lang="ts">
  import { telegramStore } from '$lib/stores/telegram'

  function handleClick() {
    $telegramStore.webapp?.HapticFeedback.impactOccurred('medium')
  }
</script>

<button on:click={handleClick}>
  Click me
</button>`,
        },
    ];

    const examples = activeFramework === 'react' ? reactExamples : sveltekitExamples;

    const copyToClipboard = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="p-6 pt-8">
            <h1 className="text-2xl font-bold text-white mb-6">Documentation</h1>

            {/* Framework Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveFramework('react')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${activeFramework === 'react'
                            ? 'bg-gradient-to-br from-[#ff9800] to-[#ffc107] text-black'
                            : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#ffc107]'
                        }`}
                >
                    React
                </button>
                <button
                    onClick={() => setActiveFramework('sveltekit')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${activeFramework === 'sveltekit'
                            ? 'bg-gradient-to-br from-[#ff9800] to-[#ffc107] text-black'
                            : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#ffc107]'
                        }`}
                >
                    SvelteKit
                </button>
            </div>

            {/* Documentation Content */}
            <div className="space-y-4">
                {examples.map((example, index) => (
                    <div
                        key={index}
                        className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden"
                    >
                        <div className="p-4 border-b border-[#2a2a2a]">
                            <h3 className="text-lg font-semibold text-white mb-1">{example.title}</h3>
                            <p className="text-gray-400 text-sm">{example.description}</p>
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => copyToClipboard(example.code, index)}
                                className="absolute top-3 right-3 p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg transition-colors"
                                title="Copy code"
                            >
                                {copiedIndex === index ? (
                                    <div className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] p-1 rounded">                                        
                                        <HugeiconsIcon
                                            icon={Tick02Icon}
                                            size={18}
                                            strokeWidth={1.5}
                                            className="text-black"
                                        />
                                    </div>
                                ) : (
                                     <HugeiconsIcon
                                        icon={Copy01Icon}
                                        size={18}                                        
                                        strokeWidth={1.5}
                                        className="text-gray-400"
                                    />
                                )}
                            </button>

                            <pre className="p-4 overflow-x-auto text-sm">
                                <code className="text-gray-300 font-mono">{example.code}</code>
                            </pre>
                        </div>
                    </div>
                ))}
            </div>

            {/* Additional Resources */}
            <div className="mt-6 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-4">
                <h3 className="text-white font-semibold mb-2">Additional Resources</h3>
                <ul className="space-y-2">
                    {activeFramework === 'react' ? (
                        <>
                            <li>
                                <a
                                    href="https://reactrouter.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent hover:underline text-sm font-medium"
                                >
                                    React Router v7 Documentation
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://core.telegram.org/bots/webapps"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent hover:underline text-sm font-medium"
                                >
                                    Telegram WebApp API
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://docs.aws.amazon.com/cdk/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent hover:underline text-sm font-medium"
                                >
                                    AWS CDK Documentation
                                </a>
                            </li>
                        </>
                    ) : (
                        <>
                            <li>
                                <a
                                    href="https://kit.svelte.dev/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent hover:underline text-sm font-medium"
                                >
                                    SvelteKit v5 Documentation
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://core.telegram.org/bots/webapps"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent hover:underline text-sm font-medium"
                                >
                                    Telegram WebApp API
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://docs.aws.amazon.com/cdk/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-gradient-to-r from-[#ff9800] to-[#ffc107] bg-clip-text text-transparent hover:underline text-sm font-medium"
                                >
                                    AWS CDK Documentation
                                </a>
                            </li>
                        </>
                    )}
                </ul>
            </div>
        </div>
    );
}

export default Documentation;