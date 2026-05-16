import { describe, expect, it } from 'vitest';
import {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
} from '../runtime/decorators';
import type { Position } from '../runtime/position';
import { getCallerPosition } from '../runtime/position';
import {
  getClassMetadata,
  setClassMetadata,
  setMethodMetadata,
  setPropertyMetadata,
} from '../runtime/store';

describe('getCallerPosition', () => {
  it('returns position with sourceFile, line, column', () => {
    const pos = getCallerPosition();

    expect(pos).toBeDefined();
    expect(pos?.sourceFile).toContain('runtime.test.ts');
    expect(typeof pos?.line).toBe('number');
    expect(typeof pos?.column).toBe('number');
    expect(pos?.line).toBeGreaterThan(0);
    expect(pos?.column).toBeGreaterThan(0);
  });
});

describe('metadata store', () => {
  const mockPos: Position = { sourceFile: '/test.ts', line: 10, column: 1 };

  it('stores and retrieves class metadata', () => {
    class TestClass {}

    setClassMetadata(TestClass, mockPos, { basePath: '/api' });
    const meta = getClassMetadata(TestClass);

    expect(meta).toEqual({
      pos: mockPos,
      props: { basePath: '/api' },
      methods: [],
      properties: [],
    });
  });

  it('stores and retrieves method metadata', () => {
    class TestClass {}

    setClassMetadata(TestClass, mockPos, {});
    setMethodMetadata(TestClass, 'getUser', mockPos, { method: 'GET' });

    const meta = getClassMetadata(TestClass);
    expect(meta?.methods).toHaveLength(1);
    expect(meta?.methods[0]).toEqual({
      name: 'getUser',
      pos: mockPos,
      props: { method: 'GET' },
    });
  });

  it('stores and retrieves property metadata', () => {
    class TestClass {}

    setClassMetadata(TestClass, mockPos, {});
    setPropertyMetadata(TestClass, 'name', mockPos, { nullable: false });

    const meta = getClassMetadata(TestClass);
    expect(meta?.properties).toHaveLength(1);
    expect(meta?.properties[0]).toEqual({
      name: 'name',
      pos: mockPos,
      props: { nullable: false },
    });
  });

  it('returns undefined for class without metadata', () => {
    class NoMetaClass {}
    expect(getClassMetadata(NoMetaClass)).toBeUndefined();
  });
});

describe('decorator factories', () => {
  it('createClassDecorator stores metadata on class', () => {
    const Controller = (basePath: string) => createClassDecorator({ basePath });

    @Controller('/users')
    class UserController {}

    const meta = getClassMetadata(UserController);
    expect(meta).toBeDefined();
    expect(meta?.props).toEqual({ basePath: '/users' });
    expect(meta?.pos.sourceFile).toContain('runtime.test.ts');
  });

  it('createClassDecorator works alone without method/property decorators', () => {
    const Service = () => createClassDecorator({ type: 'service' });

    @Service()
    class SimpleService {}

    const meta = getClassMetadata(SimpleService);
    expect(meta).toBeDefined();
    expect(meta?.props).toEqual({ type: 'service' });
    expect(meta?.methods).toHaveLength(0);
    expect(meta?.properties).toHaveLength(0);
  });

  it('createMethodDecorator stores metadata on method', () => {
    const Controller = () => createClassDecorator({});
    const Get = (path: string) => createMethodDecorator({ method: 'GET', path });

    @Controller()
    class TestController {
      @Get('/items')
      getItems() {}
    }

    const meta = getClassMetadata(TestController);
    expect(meta?.methods).toHaveLength(1);
    expect(meta?.methods[0]?.props).toEqual({ method: 'GET', path: '/items' });
  });

  it('createPropertyDecorator stores metadata on property', () => {
    const Entity = () => createClassDecorator({});
    const Column = (opts?: { nullable?: boolean }) =>
      createPropertyDecorator({ nullable: opts?.nullable ?? false });

    @Entity()
    class User {
      @Column()
      name!: string;

      @Column({ nullable: true })
      email?: string;
    }

    const meta = getClassMetadata(User);
    expect(meta?.properties).toHaveLength(2);
    expect(meta?.properties[0]?.props).toEqual({ nullable: false });
    expect(meta?.properties[1]?.props).toEqual({ nullable: true });
  });
});
