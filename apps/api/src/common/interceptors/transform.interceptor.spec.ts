import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const mockContext = {} as ExecutionContext;

  it('should wrap response data in success envelope', (done) => {
    const mockData = { id: 1, name: 'test' };
    const callHandler: CallHandler = {
      handle: () => of(mockData),
    };

    interceptor.intercept(mockContext, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'test' },
      });
      done();
    });
  });

  it('should wrap array data in success envelope', (done) => {
    const mockData = [{ id: 1 }, { id: 2 }];
    const callHandler: CallHandler = {
      handle: () => of(mockData),
    };

    interceptor.intercept(mockContext, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: [{ id: 1 }, { id: 2 }],
      });
      done();
    });
  });

  it('should wrap null data in success envelope', (done) => {
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(mockContext, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: null,
      });
      done();
    });
  });

  it('should wrap string data in success envelope', (done) => {
    const callHandler: CallHandler = {
      handle: () => of('message'),
    };

    interceptor.intercept(mockContext, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: 'message',
      });
      done();
    });
  });
});
