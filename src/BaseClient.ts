import fetch, { FetchError, RequestInit, Response } from "node-fetch"
import prompt                                       from "prompt-sync"
import clc                                          from "cli-color"
import { format }                                   from "util"
import Logger                                       from "./Logger"
import {
    getAccessToken,
    headersToObject,
    lock,
    print,
    toAbsolute,
    wait
} from "./utils"


export interface BaseClientOptions {
    clientId        : string
    tokenEndpoint   : string
    privateJWKorSecret: Record<string, any> | string
    baseUrl         : string
    resources       : string[]
    logger          : Logger
    retryStatusCodes: number[]
    retryDelay      : number
    retryLimit      : number
    requestTimeout  : number
    destination     : string
    [key: string]   : any
}

export default class BaseClient
{
    protected accessToken: string = ""

    protected accessTokenExpiresAt: number = 300

    public requestsCount: number = 0

    protected options: BaseClientOptions

    constructor(options: BaseClientOptions)
    {
        this.options = options
    }

    private async getAccessToken()
    {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }

        const { token, expiresAt } = await getAccessToken({
            clientId     : this.options.clientId,
            tokenEndpoint: this.options.tokenEndpoint,
            privateJWK   : this.options.privateJWKorSecret as any,
            resources    : this.options.resources
        }, this.options.logger)

        this.accessToken = token
        this.accessTokenExpiresAt = expiresAt
        this.requestsCount++
        return token
    }

    protected async getAuthorizationHeader(): Promise<string>
    {
        if (typeof this.options.privateJWKorSecret === "string") {
            return "Basic " + Buffer.from(
                this.options.clientId + ":" + this.options.privateJWKorSecret
            ).toString("base64")
        }
        const release = await lock()
        const header = `Bearer ${ await this.getAccessToken() }`
        release()
        return header
    }

    private async _fetch(url: string, options: RequestInit)
    {
        const { requestTimeout, logger } = this.options
        if (!requestTimeout) {
            return await fetch(url, options)
        }
        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), requestTimeout)
        const start = Date.now()
        // @ts-ignore
        const response = await fetch(url, { ...options, signal: abortController.signal })
        clearTimeout(timer);
        const time = Number(Date.now() - start).toLocaleString()
        this.requestsCount++
        await logger.request(url, response, options, time)
        return response;
    }

    private async buildRequestOptions(options: RequestInit = {}): Promise<RequestInit>
    {
        const _options: RequestInit = {
            method: "GET",
            ...options,
            headers: {
                accept: "application/json+fhir",
                ...options?.headers
            }
        };

        // Can opt-out by passing { authorization: undefined } in headers
        if (!("authorization" in _options.headers!)) {
            const authorization = await this.getAuthorizationHeader()
            if (authorization) {
                (_options.headers as any).authorization = authorization
            }

            if (options?.headers) {
                Object.assign(_options.headers as any, options.headers)
            }
        }

        return _options
    }

    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: true): Promise<Response>;
    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: boolean): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit, raw?: boolean)
    {
        const { baseUrl, logger, retryLimit, retryDelay, retryStatusCodes, manualRetry, headers = {} } = this.options

        const _options = await this.buildRequestOptions({ ...options, headers: { ...headers, ...options?.headers } })

        url = toAbsolute(url, baseUrl)

        let response: Response, count = retryLimit
        do {
            await wait(count === retryLimit ? 0 : retryDelay)
            try {
                response = await this._fetch(url, _options)
            } catch (ex) {
                const { name, message } = (ex as Error)
                await logger.error(
                    "%s: %s (%s %s)",
                    name,
                    name === 'AbortError' ? "Request timed out! " + count + " retry attempts left" : message,
                    _options.method,
                    url
                )

                if (name !== "AbortError") {
                    throw ex
                }
            }
        } while ((!response! || (!response.ok && response.status !== 304 && retryStatusCodes.includes(response.status))) && --count > 0);

        if (!response!) {
            const msg = `Failed to get any response from: ${_options.method} ${url}`
            await logger.error(msg)
            throw new FetchError(msg, "fetch-error")
        }

        // Manual retry
        while (!response.ok && response.status !== 304) {
            
            const txt = await response.text()
            

            // istanbul ignore next (manual retry)
            if (manualRetry && process.env.NODE_ENV !== "test" && this.askToRetry(url, response, _options, txt)) {
                print.commit()
                response = await this._fetch(url, _options)
                continue
            }

            throw new FetchError(format(
                "GET %s --> %s %s: %j; Response headers: %j",
                url,
                response.status,
                response.statusText,
                txt,
                response.headers.raw()
            ), "fetch-error-" + response.status)
        }

        if (raw) {
            return response
        }
        
        let body = await response.text();
        let type = response.headers.get("Content-Type") + "";
        
        if (body.length && type.match(/\bjson\b/i)) {
            body = JSON.parse(body);
        }

        return { response, body: body as T }
    }

    // istanbul ignore next
    protected askToRetry(url: string, response: Response, options: RequestInit, txt: string)
    {
        console.log(clc.bold.red("\n\nRequest failed!"))
        console.log(clc.bold.red("---------------------------------------"))
        console.log(clc.bold("\nRequest:"), clc.cyan(options.method || "GET", url))
        console.log(clc.bold("\nRequest Body:"))
        console.log(options.body)
        console.log(clc.bold("\nRequest Headers:"))
        console.log(options.headers)
        console.log(clc.bold("\nResponse:"), response.status, response.statusText)
        console.log(clc.bold("\nResponse Headers:"))
        console.log(headersToObject(response.headers))
        console.log(clc.bold("\nResponse Body:"))
        console.log(clc.cyan(txt.substring(0, 200) + (txt.length > 200 ? "..." : "")))
        console.log(clc.beep);
        console.log(clc.bold.red("---------------------------------------\n\n"))
        const answer = prompt()(clc.yellow.bold("Would you like to retry this request? [Y/n]"));
        return !answer || answer.toLowerCase() === 'y'
    }
}
