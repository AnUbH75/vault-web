import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CloudService } from './cloud.service';

describe('CloudService Checksum', () => {
  let service: CloudService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CloudService],
    });

    service = TestBed.inject(CloudService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch file checksum from /files/checksum endpoint', (done) => {
    const mockResponse = {
      filePath: 'test.pdf',
      checksum:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      algorithm: 'SHA-256',
    };

    service.getFileChecksum('test.pdf').subscribe((res) => {
      expect(res.checksum).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
      expect(res.algorithm).toBe('SHA-256');
      done();
    });

    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/files/checksum'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('path')).toBe('test.pdf');
    req.flush(mockResponse);
  });

  it('should support alternative property names (e.g. hash or sha256)', (done) => {
    const mockResponse = {
      hash: 'abc123sha256hash',
    };

    service.getFileChecksum('docs/file.txt').subscribe((res) => {
      expect(res.checksum).toBe('abc123sha256hash');
      expect(res.algorithm).toBe('SHA-256');
      done();
    });

    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/files/checksum'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
