import { expect } from "chai"
import TaskRunner from "../src/TaskRunner"
import { wait }   from "../src/utils"


describe("TaskRunner", () => {
    it ("adding jobs to empty queue", async () => {
        const runner = new TaskRunner(2)
        const log: any[] = [];
        const job = runner.add(
            async () => { await wait(50); log.push(1); },
            async () => { await wait(10); log.push(2); },
        )
        expect(log).to.deep.equal([])
        await job
        expect(log).to.deep.equal([2, 1])
    })

    it ("adding jobs to non-empty queue", async () => {
        const runner = new TaskRunner(2)
        const log: any[] = [];
        const job1 = runner.add(
            async () => { await wait(50); log.push(1); },
            async () => { await wait(40); log.push(2); },
        )
        const job2 = runner.add(
            async () => { await wait(30); log.push(3); },
            async () => { await wait(20); log.push(4); },
        )
        await job1
        await job2
        expect(log).to.deep.equal([4, 3, 2, 1])
    })

    it ("test 3", async () => {
        const runner = new TaskRunner(2)
        const log: any[] = [];
        await runner.add(
            async () => { await wait(10); log.push(1); },
            async () => { await wait(10); log.push(2); },
            async () => { await wait(10); log.push(3); },
            async () => { await wait(10); log.push(4); },
        )
        expect(log).to.deep.equal([1, 2, 3, 4])
    })
})
