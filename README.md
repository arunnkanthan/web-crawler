
# Web Crawler

This project implements a simple web crawler written in JavaScript. Given a starting URL, the crawler visits each URL it finds on the same domain, prints each visited URL, and logs a list of links found on that page. The crawler only follows internal links and ignores external ones. It handles retries for failed requests and writes the crawled data into a JSON file.

## Features

- **Crawls only the same domain**: External links are ignored.
- **Concurrency control**: Limits the number of concurrent requests to avoid overwhelming the server.
- **Retry mechanism**: Retries failed requests up to a configurable number of times (`maxRetries`).
- **Logs crawled data**: Outputs crawled URLs and their corresponding links in a JSON file (`crawled_data.json`).
- **Tracks failed URLs**: URLs that fail after the maximum retry attempts are tracked for later inspection.

## Setup

1. If you dont have node installed ploease install it using the link provided. Otherwise skip this step.
   ```
   https://nodejs.org/en/download/package-manager
   ```


2. Open a termianl window & install dependencies by running:

   ```bash
   npm install
   ```

## Usage

To run the crawler, use the following command:

```bash
npm run start <startUrl>
```

Where `<startUrl>` is the initial URL from which the crawler should begin.

Example:

```bash
npm run start https://www.facebook.com/
```

This will start crawling the `facebook.com` domain, printing each URL visited, the links found on that page, and storing the results in a `crawled_data.json` file. If there are any failed attempts of visting a URL, it will be stored in a seperate JSON file in `failed_urls.json` file.

### Configuration

- `maxConcurrency`: The maximum number of concurrent requests (default: `5`).
- `maxRetries`: The maximum number of retry attempts for failed requests (default: `3`).

## Running Unit Tests

To run the unit tests, use the following command:
```bash
npm test
```

## Program Structure & Design Decisions

### 1. **Program Structure**

The program is structured using object-oriented principles. The core logic is encapsulated in the `WebCrawler` class, which manages state such as the queue of URLs to crawl, visited URLs, and the data being collected.

#### Key Methods:
- `crawl`: Starts the crawling process, visiting URLs and managing concurrency.
- `fetchAndProcess`: Fetches a URL, extracts the links, and retries if necessary.
- `handleRetry`: Handles retries for failed URL requests.
- `extractLinks`: Extracts all links (`<a href="...">`) from a given page.
- `delay`: Adds a delay between iterations to reduce CPU churn.
- `writeToFiles`: Saves the crawled data and failed URL requests to 2 separate files.

### 2. **Trade-Offs**

- **Concurrency vs. Rate Limiting**: We allow for concurrent requests to speed up the crawling process, but the number of simultaneous requests is limited to avoid overwhelming the server. This is configurable via `maxConcurrency`.
  
- **Error Handling & Retries**: The crawler retries failed requests up to `maxRetries` times, improving reliability. There is a cap on retries to prevent unnecessary strain on the server and reduce infinite retry loops.

- **Domain Restriction**: The crawler only follows links that belong to the same domain as the start URL, simplifying the logic and avoiding potential legal and technical issues with external websites.

### 3. **Program Behavior**

- **URL Discovery**: The program starts with the given URL and discovers more URLs by parsing the page for `<a href="...">` tags. It only adds URLs that belong to the same domain, ensuring that the crawler doesn't go off-site.
  
- **Concurrency Control**: Concurrency is controlled with the `maxConcurrency` setting. The `activeRequests` counter ensures that only the specified number of requests are in progress at any time.

- **Retry Logic**: If a request fails, the crawler retries up to `maxRetries` times. Failed URLs that exceed the retry limit are logged for later inspection.

- **Output**: The program outputs a JSON file (`crawled_data.json`) that contains each visited URL and the links found on it. Additionally, any URLs that fail after retries are stored in the `failedUrls` object and saved in a separate JSON file (`failed_urls.json`).

### 4. **Concurrency Usage**

Concurrency is employed to speed up the crawling process. The `maxConcurrency` limit ensures that no more than a set number of requests are active simultaneously, avoiding overloading the server and preventing excessive resource usage. This approach makes the crawler faster compared to a sequential model but still respects the server's capacity by limiting active requests.

### 5. **Error Handling**

The crawler includes a retry mechanism that retries failed requests up to `maxRetries` times. If the request fails after the maximum number of retries, it’s logged as a failure and not retried. This helps to handle issues such as temporary network failures, server unavailability, or transient problems.

Additionally, the crawler ensures that URLs that repeatedly fail are tracked in the `failedUrls` object for later review.

## Questions/Clarifications asked via Email
These are questions that I asked via email. Since I didn't hear back, These assumptions were made.

- I understand the crawler should crawl on the links under the subdomain. But should the crawler crawl ALL of those links or just unique ones found under the subdomain?
   - I assumed to crawl on the unique links I found on each page. Some of the pages contained duplicate or more than one of the same links. To avoid extra computational work, I only crawled on the unique links found.

- Should the results of the crawler be saved to a file, displayed in the CLI or should I create a small frontend component to display them?
   - I decided to output the results of the crawler to two JSON files. One that contains the results of the crawled data. Another file that kept track of URLs that were unsuccessful after multiple retries, if there were any. The point of the failed data was to come back and view them at a later time. Future improvements include a suggested frontend component.

- Would you also like some sort of testing done as well, i.e. unit testing?
   - To ensure each method performs as intended, I created some unit tests to account for that.


## Future Add-Ons

- **Rate Limiting**: Implement dynamic rate-limiting based on server response headers (e.g., `X-RateLimit-Remaining`).
- **Exponential Backoff**: Improve retry logic by implementing exponential backoff, which would slow down retries when the server is under heavy load.
- **Logging**: Enhance logging to provide more detailed insights into the crawling process, such as the number of retries per URL.
- **Montioring**: Implement real-time progress visualization via CLI or a frontend component dashboard (i.e. preferrably using React).

