import * as mammoth from 'mammoth/mammoth.browser';

type WorkerMsg = { arrayBuffer: ArrayBuffer };
type WorkerResponse = { html?: string; error?: string };

self.onmessage = async (event: MessageEvent<WorkerMsg>) => {
    try {
        const { arrayBuffer } = event.data || {};
        if (!(arrayBuffer instanceof ArrayBuffer)) {
            throw new Error('Expected ArrayBuffer in message.');
        }

        console.log('Worker received ArrayBuffer of length:', arrayBuffer.byteLength);

        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        let htmlString = value || '';

        const pageBreakRegex = /<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*><\/p>/i;
        if (pageBreakRegex.test(htmlString)) {
            htmlString = htmlString.split(pageBreakRegex)[0]!;
        }

        console.log('Worker sending back HTML of length:', htmlString.length);

        self.postMessage({ html: htmlString } as WorkerResponse);
    } catch (e: any) {
        self.postMessage({ error: e?.message ?? String(e) } as WorkerResponse);
    }
};
