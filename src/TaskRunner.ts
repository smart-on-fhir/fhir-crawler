
type Task = () => Promise<any>

export default class TaskRunner
{
    private tasks: Task[];

    private _job: Promise<any>;

    private parallel: number;

    constructor(parallel: number) {
        this.parallel = Math.max(parallel, 1)
        this.tasks = []
        this._job = Promise.resolve();
    }

    public get job() {
        return this._job
    }

    public add(...tasks: Task[]) {
        const wasEmpty = this.tasks.length === 0
        this.tasks.push(...tasks)
        wasEmpty && this.run()
        return this._job
    }

    private run() {
        const batch: Promise<void>[] = []

        const wrap = (fn: Task) => async () => {
            await fn()
            if (this.tasks.length) {
                await wrap(this.tasks.shift()!)() 
            }
        }

        while (this.tasks.length && batch.length < this.parallel) {
            batch.push(wrap(this.tasks.shift()!)())
        }

        this._job = Promise.all(batch)
    }
}
