import { Controller, createApp, Get, inject, pathParam } from '@koya/core';

class Greeter {
  greet(name: string) {
    return `hello, ${name}`;
  }
}

@Controller('/hello')
class HelloController {
  // constructor injection (inject は @koya/core が @needle-di/core から re-export)
  constructor(private greeter = inject(Greeter)) {}

  @Get('/:name')
  greet() {
    return { message: this.greeter.greet(pathParam('name')) };
  }
}

const app = createApp({ providers: [Greeter, HelloController] });
const worker = app.http({ controllers: [HelloController] }).toWorker();

const res = await worker.fetch(new Request('https://example.local/hello/koya'));
console.log(res.status, await res.json());
