const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const WebCrawler = require('./crawler');

jest.mock('axios');
jest.mock('fs');

describe('WebCrawler', () => {
    let crawler;

    beforeEach(() => {
        crawler = new WebCrawler('http://example.com');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should correctly initialize the crawler with the start URL and default parameters', () => {
        expect(crawler.startUrl).toBe('http://example.com');
        expect(crawler.domainName).toBe('example.com');
        expect(crawler.visitedUrls).toEqual(new Set());
        expect(crawler.urlQueue).toEqual(['http://example.com']);
        expect(crawler.maxConcurrency).toBe(5);
        expect(crawler.maxRetries).toBe(3);
    });

    test('should fetch and process a URL and extract links', async () => {
        const htmlContent = '<html><body><a href="/page1">Link</a></body></html>';
        const links = ['http://example.com/page1'];

        axios.get.mockResolvedValue({ data: htmlContent });
        cheerio.load = jest.fn().mockReturnValue({
            'a[href]': { each: jest.fn().mockImplementation((cb) => cb(0, { attr: () => '/page1' })) }
        });

        await crawler.fetchAndProcess('http://example.com');

        expect(axios.get).toHaveBeenCalledWith('http://example.com');
        expect(crawler.crawledData['http://example.com']).toEqual(links);
        expect(crawler.urlQueue).toContain('http://example.com/page1');
    });

    test('should correctly extract links from a page', () => {
        const html = '<html><body><a href="/link1">Link 1</a><a href="/link2">Link 2</a></body></html>';
        const baseUrl = 'http://example.com';
        const links = crawler.extractLinks(html, baseUrl);

        expect(links).toEqual([
            'http://example.com/link1',
            'http://example.com/link2'
        ]);
    });

    test('should delay requests to prevent overloading the server', async () => {
        const delayMock = jest.spyOn(crawler, 'delay');
        const delayTime = 200;

        await crawler.delay(delayTime);

        // ensure delay is invoked correctly
        expect(delayMock).toHaveBeenCalledWith(delayTime); 
    });

    test('should write crawled data to files', () => {
        const crawledData = { 'http://example.com': ['http://example.com/page1'] };
        const failedUrls = { 'http://example.com/fail': 3 };

        crawler.crawledData = crawledData;
        crawler.failedUrls = failedUrls;

        fs.writeFileSync.mockClear();
        crawler.writeToFiles();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            './output/crawled_data.json',
            JSON.stringify(crawledData, null, 2)
        );
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            './output/failed_urls.json',
            JSON.stringify(failedUrls, null, 2)
        );
    });

    test('should create the output directory if it does not exist', () => {
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockClear();

        crawler.writeToFiles();

        expect(fs.mkdirSync).toHaveBeenCalledWith('./output');
    });

    test('should handle the edge case when no startUrl is provided', () => {
        expect(() => {
            new WebCrawler(); // no start URL
        }).toThrowError('Start URL is required.');
    
        expect(() => {
            new WebCrawler(''); // invalid (empty string) startUrl is provided
        }).toThrowError('Start URL is required.');
    
        expect(() => {
            new WebCrawler('invalid-url'); // invalid URL (not parsable) is provided
        }).toThrowError('Invalid URL provided.');
    });

    test('should respect maxConcurrency during crawling', async () => {
        crawler.maxConcurrency = 2;
        const mockFetch = jest.fn(() => Promise.resolve());
        crawler.fetchAndProcess = mockFetch;

        crawler.urlQueue = [
            'http://example.com', 
            'http://example.com/page1', 
            'http://example.com/page2'
        ];

        await crawler.crawl();

        // all URLs should be processed
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('should retry fetching a failed URL up to maxRetries', async () => {
        const url = 'http://example.com/retry';
        const maxRetries = 3;
        
        // mock the first 3 failures and the 4th call should succeed
        axios.get
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockRejectedValueOnce(new Error('Network Error')) 
            .mockRejectedValueOnce(new Error('Network Error')) 
            .mockResolvedValueOnce({ data: '<html></html>' });
        
        await crawler.handleRetry(url); // simulate the first retry
        expect(crawler.retryCounts[url]).toBe(1); // retry count should be 1 after first retry
        
        await crawler.handleRetry(url); // simulate the second retry
        expect(crawler.retryCounts[url]).toBe(2); 
        
        await crawler.handleRetry(url); // simulate the third retry
        expect(crawler.retryCounts[url]).toBe(3); 
        
        await crawler.fetchAndProcess(url); // now process it successfully
        expect(crawler.retryCounts[url]).toBe(3); // retry count should remain 3 after success
    });
    
    test('should not retry a URL after exceeding maxRetries', async () => {
        const url = 'http://example.com/retry';
        const maxRetries = 3;
        
        // mock the first 3 failures
        axios.get
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockRejectedValueOnce(new Error('Network Error'));
        
        await crawler.handleRetry(url);
        await crawler.handleRetry(url);
        await crawler.handleRetry(url);

        // now handle retries again and ensure no more retries are done
        await crawler.handleRetry(url); // exceed max retries
        
        expect(crawler.retryCounts[url]).toBe(3); // retry count should still be 3
        expect(crawler.failedUrls[url]).toBe(3); // the URL should be in the failedUrls after max retries
    });

    test('should handle invalid links gracefully during extraction', () => {
        const htmlContent = `
            <a href="http://valid-link.com">Valid</a>
            <a href="invalid-link">Invalid</a>
            <a href="">Empty</a>
            <a href="http://valid-link-2.com">Another Valid</a>
        `;
        const baseUrl = 'http://example.com';
    
        const links = crawler.extractLinks(htmlContent, baseUrl);
    
        // expect the valid links to be extracted correctly, with trailing slashes
        expect(links).toContain('http://valid-link.com/'); // valid URL with trailing slash
        expect(links).toContain('http://valid-link-2.com/'); // another valid URL with trailing slash
    
        // invalid and empty links should not be included
        expect(links).not.toContain('invalid-link');  // invalid link should be skipped
        expect(links).not.toContain('');  // empty link should be skipped
    
        // check that the relative link has been resolved correctly
        expect(links).toContain('http://example.com/invalid-link'); // this should be resolved relative to baseUrl
    
        // check the full URLs with trailing slashes
        expect(links).not.toContain('http://valid-link.com'); // expect the URL to include trailing slash
    });
});
