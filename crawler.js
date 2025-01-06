const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { URL } = require('url');

class WebCrawler {
    constructor(startUrl, maxConcurrency = 5, maxRetries = 3) {
        if (!startUrl) {
            throw new Error('Start URL is required.');
        }

        try {
            this.startUrl = startUrl;                      // the URL to start crawling
            this.domainName = new URL(startUrl).hostname;  // extracted domain of the starting URL
        } catch (error) {
            throw new Error('Invalid URL provided.');
        }

        this.visitedUrls = new Set();                      // keep track of visited URLs
        this.urlQueue = [startUrl];                        // queue of URLs to be crawled
        this.maxConcurrency = maxConcurrency;              // max concurrency, default 5
        this.activeRequests = 0;                           // ongoing HTTP requests
        this.maxRetries = maxRetries;                      // maximum retries for failed requests
        this.retryCounts = {};                             // retry counts per URL
        this.crawledData = {};                             // store crawled data
        this.failedUrls = {};                              // store failed URLs after retries, if any
        this.dynamicDelay = 100;
    }
    
    // Starts the crawling process
    async crawl() {
        while (this.urlQueue.length > 0 || this.activeRequests > 0) {
            if (this.activeRequests < this.maxConcurrency && this.urlQueue.length > 0) {
                const url = this.urlQueue.shift();
                if (!this.visitedUrls.has(url)) {
                    this.visitedUrls.add(url);
                    this.activeRequests++;
                    this.fetchAndProcess(url).finally(() => this.activeRequests--);
                }
            } else {
                await this.delay(this.dynamicDelay);
            }
        }

        // after all URLs, including retries, have been processed, log completion
        console.log("\nCrawling complete!");

        // write results to files
        this.writeToFiles();
    }

    // Fetches the page and processes links
    async fetchAndProcess(url) {
        try {
            console.log(`\nVisiting: ${url}`);

            const { data, headers } = await axios.get(url);
            const links = this.extractLinks(data, url);

            // log, remove duplicate links, and store in crawledData for this page
            const uniqueLinks = [...new Set(links)];

            // uncomment if you'd like to log the links via the console
            // console.log(`Links found on ${url}:`, uniqueLinks);
            
            this.crawledData[url] = uniqueLinks;

            this.adjustRateLimit(headers);

            // add found links to the URL queue, but avoid revisiting them
            for (const link of links) {
                if (!this.visitedUrls.has(link) && new URL(link).hostname === this.domainName) {
                    this.urlQueue.push(link);
                }
            }

            console.log(`\nDone visiting: ${url}`);
        } catch (error) {
            console.error(`\nFailed to fetch ${url}: ${error.message}...starting to retry failed request`);
            this.handleRetry(url, error.response?.headers);
        }
    }

    // Handles retries for failed requests
    async handleRetry(url, headers) {
        if (!(url in this.retryCounts)) {
            this.retryCounts[url] = 0;
        }

        if (this.retryCounts[url] < this.maxRetries) {
            this.retryCounts[url]++;

            const exxponentialBackOffDelay = Math.pow(2, this.retryCounts[url] * 100);

            console.log(`\nRetrying ${url} (${this.retryCounts[url]}/${this.maxRetries})...`);

            await this.delay(exxponentialBackOffDelay);

           if (headers) {
            this.adjustRateLimit(headers);
           }

            this.urlQueue.push(url); // requeue the URL for retry
        } else {
            // if we've exhausted retries, mark the URL as failed
            console.log(`\nMax retries reached for ${url}.`);
            this.failedUrls[url] = this.retryCounts[url];
        }
    }

    // Extracts all links from the page's HTML content
    extractLinks(html, baseUrl) {
        const htmlContent = cheerio.load(html);
        const links = [];

        htmlContent('a[href]').each((_, element) => {
            const href = htmlContent(element).attr('href');

            try {
                const absoluteUrl = new URL(href, baseUrl).href;
                links.push(absoluteUrl);
            } catch (e) {
                console.error(`\nInvalid URL skipped: ${href}`);
            }
        });

        return links;
    }

    async adjustRateLimit(headers) {
        if (headers['x-ratelimit-remaining'] !== undefined) {
            const remaining = parseInt(headers['x-ratelimit-remaining'], 10);

            if (remaining === 0) {
                console.log('Rate limit exceeded...backing off');

                this.dynamicDelay = Math.max(this.dynamicDelay * 2, 1000);
            } else {
                this.dynamicDelay = Math.max(100, this.dynamicDelay / 2);
            }
        }

        if (headers['retry-after'] !== undefined) {
            const retryAfter = parseInt(headers['retry-after'], 10) * 1000;
            log (`\nServer requested retry-after ${retryAfter} ms`);

            this.dynamicDelay = Math.max(this.dynamicDelay, retryAfter);
        }
    }

    // Delay used for rate limiting, to prevent overwhelming the server with too many requests at once 
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Write the crawled data and failed URL request results to separate files
    writeToFiles() {
        if (!fs.existsSync('./output')) {
            fs.mkdirSync('./output');
        }

        const crawledDataFilePath = './output/crawled_data.json';
        fs.writeFileSync(crawledDataFilePath, JSON.stringify(this.crawledData, null, 2));

        const failedUrlsPath = './output/failed_urls.json';
        fs.writeFileSync(failedUrlsPath, JSON.stringify(this.failedUrls, null, 2));

        console.log('\nCheck the output folder for your results');
    }
}

// Entry point for the script when run directly from the command line
if (require.main === module) {
    const startUrl = process.argv[2];

    if (!startUrl) {
        console.error('Usage: node crawler.js <startUrl>');
        process.exit(1);
    }

    const crawler = new WebCrawler(startUrl);
    crawler.crawl();
}

module.exports = WebCrawler;
