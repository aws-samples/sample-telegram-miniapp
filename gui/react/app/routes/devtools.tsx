import type { LoaderFunctionArgs } from 'react-router';

/**
 * Chrome DevTools source mapping endpoint
 * https://developer.chrome.com/blog/new-in-devtools-120#local-overrides
 *
 * This endpoint tells Chrome DevTools where to find local source files
 * for your deployed production app, enabling local debugging of production.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const hostname = url.hostname;

	const localPath = process.env.DEVTOOLS_WORKSPACE_PATH || '/home/user/code/miniapp';

	const config = {

		origins: [
			{
				origin: `https://${hostname}`,
				folder: `file://${localPath}/gui/react`
			}
		]
	};

	return new Response(JSON.stringify(config, null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}