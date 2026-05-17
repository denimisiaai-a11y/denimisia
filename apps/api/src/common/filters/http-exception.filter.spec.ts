import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ headers: {}, url: '/test', method: 'GET' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle HttpException with string message', () => {
    filter.catch(
      new HttpException('Not Found', HttpStatus.NOT_FOUND),
      mockHost,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        error: 'Not Found',
        message: 'Not Found',
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    filter.catch(
      new HttpException(
        { message: 'Validation failed', errors: ['email required'] },
        HttpStatus.BAD_REQUEST,
      ),
      mockHost,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'Validation failed',
      }),
    );
  });

  it('should handle non-HttpException as 500 Internal Server Error', () => {
    filter.catch(new Error('Something broke'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
      }),
    );
  });

  it('should handle unknown exception types', () => {
    filter.catch('string error', mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
      }),
    );
  });

  it('should handle null/undefined exceptions', () => {
    filter.catch(null, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
      }),
    );
  });

  it('should propagate the requestId from headers when present', () => {
    const hostWithReqId = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({
          headers: { 'x-request-id': 'req-abc-123' },
          url: '/test',
          method: 'GET',
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new HttpException('Bad', HttpStatus.BAD_REQUEST),
      hostWithReqId,
    );

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-abc-123' }),
    );
  });

  it('should include path and timestamp in the body', () => {
    filter.catch(new HttpException('x', HttpStatus.BAD_REQUEST), mockHost);

    const body = mockResponse.json.mock.calls[0][0] as {
      path: string;
      timestamp: string;
    };
    expect(body.path).toBe('/test');
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
