import { appendFileSync, readFileSync, writeFileSync } from "fs"
import { expect }                      from "chai"
import { format }                      from "util"
import { appendFile }                  from "fs/promises"
import { emptyFolder }                 from "./lib"
import { ndjsonEntries, readLine }     from "../src/utils"


afterEach(async () => {
    emptyFolder(__dirname + "/tmp")
})

describe("logs", () => {
    it ("work fine", async () => {

        const path    = "./test/tmp/test_request_log.txt"
        const pattern = "%s\t%s\t%s\t%s\t%s\t%s\t%j\t%j"

        writeFileSync(path, "", "utf8")

        function log(...args: any[]) {
            return appendFile(path, format(pattern, ...args) + "\n")
        }

        function read() {
            return readFileSync(path, "utf8")
        }

        async function test(input: any[], out: string) {
            await log(...input)
            expect(read()).to.equal(out)
        }

        await test(["date"], "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n")

        await test(["date", "GET"], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n"
        ].join(""))

        await test(["date", "GET", "url"], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t%s\t%s\t%s\t%j\t%j\n"
        ].join(""))

        await test(["date", "GET", "url", 100], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\t%s\t%s\t%j\t%j\n"
        ].join(""))

        await test(["date", "GET", "url", 100, "OK"], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t%s\t%j\t%j\n"
        ].join(""))

        await test(["date", "GET", "url", 100, "OK", 5], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t5\t%j\t%j\n"
        ].join(""))

        await test(["date", "GET", "url", 100, "OK", 5, {}], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t5\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t5\t{}\t%j\n"
        ].join(""))

        await test(["date", "GET", "url", 100, "OK", 5, {}, []], [
            "date\t%s\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\t%s\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t%s\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\t%s\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t%s\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t5\t%j\t%j\n",
            "date\tGET\turl\t100\tOK\t5\t{}\t%j\n",
            "date\tGET\turl\t100\tOK\t5\t{}\t[]\n"
        ].join(""))
    })
})

describe("readLine", () => {
    
    it ("works with \\n", () => {
        const filePath = __dirname + "/tmp/test.txt"
        writeFileSync(filePath, "a\nb\nc", "utf8")
        const lines = []
        for (const line of readLine(filePath)) {
            lines.push(line)
        }
        expect(lines).to.deep.equal(["a", "b", "c"])
    })

    it ("works with \\r\\n", () => {
        const filePath = __dirname + "/tmp/test.txt"
        writeFileSync(filePath, "a\r\nb\r\nc", "utf8")
        const lines = []
        for (const line of readLine(filePath)) {
            lines.push(line)
        }
        expect(lines).to.deep.equal(["a", "b", "c"])
    })

    it ("works with \\r", () => {
        const filePath = __dirname + "/tmp/test.txt"
        writeFileSync(filePath, "a\rb\rc", "utf8")
        const lines = []
        for (const line of readLine(filePath)) {
            lines.push(line)
        }
        expect(lines).to.deep.equal(["a", "b", "c"])
    })

    it ("works with mixed EOLs", () => {
        const filePath = __dirname + "/tmp/test.txt"
        writeFileSync(filePath, "a\r\nb\rc\nd", "utf8")
        const lines = []
        for (const line of readLine(filePath)) {
            lines.push(line)
        }
        expect(lines).to.deep.equal(["a", "b", "c", "d"])
    })

    it ("works with huge lines", () => {
        const filePath = __dirname + "/tmp/test.txt"
        const line = "x".repeat(1024 * 64 * 3)
        writeFileSync(filePath, `${line}\n${line}`, "utf8")
        const lines = []
        for (const line of readLine(filePath)) {
            lines.push(line)
        }
        expect(lines).to.deep.equal([line, line])
    })

})

describe("ndjsonEntries", () => {
    afterEach(async () => {
        emptyFolder(__dirname + "/tmp")
    })

    it ("works", () => {
        const filePath = __dirname + "/tmp/test.txt"
        writeFileSync(filePath, '{"n":1}\n{"n":2}\n{"n":3}', "utf8")
        const entries = []
        for (const entry of ndjsonEntries(filePath)) {
            entries.push(entry)
        }
        expect(entries).to.deep.equal([{ n:1 }, { n:2 }, { n:3 }])
    })

    it ("works ar scale", () => {
        const cnt      = 10_000
        const filePath = __dirname + "/tmp/test.txt"
        for (let i = 1; i <= cnt; i++) {
            appendFileSync(filePath, `{"n":${i}}\n`, "utf8")
        }
        
        let line: any, i = 0; 
        for (const entry of ndjsonEntries(filePath)) {
            line = entry
            if (++i % 100) {
                expect(line).to.deep.equal({ n: i })
            }
        }

        expect(line).to.deep.equal({ n: cnt })
    })

    it ("throws in case of bad json", () => {
        const filePath = __dirname + "/tmp/test.txt"
        writeFileSync(filePath, '{"n":1}\n{"n":}\n{"n":3}', "utf8")
        const entries = ndjsonEntries(filePath)
        expect(entries.next().done).to.equal(false)
        expect(() => entries.next()).to.throw()
        expect(entries.next().done).to.equal(true)
    })
})
