import { of, throwError, Subject } from 'rxjs';
import { CloudComponent } from './cloud.component';
import { CloudService } from '../../services/cloud.service';
import { ScanJobDto } from '../../models/dtos/ScanJobDto';

/**
 * Exercises the folder virus-scan state machine end to end with a mocked
 * CloudService and Jasmine's fake clock driving the poll timer. Covers the
 * running/completed transitions, disabled/unreachable-scanner detection, the
 * clean result, rate-limit and expired-job errors, and that polling stops on a
 * terminal status or when the dialog closes (including a close that races the
 * initial start request).
 */
describe('CloudComponent virus scan', () => {
  let component: CloudComponent;
  let cloudMock: jasmine.SpyObj<CloudService>;

  const runningJob: ScanJobDto = {
    jobId: 'job-1',
    path: '',
    status: 'RUNNING',
    filesScanned: 2,
    infectedCount: 0,
  };

  const noopToast = {
    success: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  beforeEach(() => {
    jasmine.clock().install();
    cloudMock = jasmine.createSpyObj<CloudService>('CloudService', [
      'startFolderScan',
      'getScanJob',
    ]);
    component = new CloudComponent(
      cloudMock,
      {} as never,
      noopToast as never,
      {} as never,
      {} as never,
    );
    component.rootPath = '/root';
    component.currentFolder = { path: '/root', name: 'root' } as never;
  });

  afterEach(() => jasmine.clock().uninstall());

  it('polls until COMPLETED, then stops and exposes infected findings', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    const stillRunning: ScanJobDto = { ...runningJob, filesScanned: 3 };
    const completed: ScanJobDto = {
      jobId: 'job-1',
      path: '',
      status: 'COMPLETED',
      filesScanned: 3,
      infectedCount: 1,
      findings: [{ path: 'a/evil.exe', verdict: 'INFECTED', detail: 'Eicar' }],
    };
    cloudMock.getScanJob.and.returnValues(of(stillRunning), of(completed));

    component.scanCurrentFolder();
    expect(component.scanning).toBeTrue();
    expect(component.scanJob?.status).toBe('RUNNING');

    jasmine.clock().tick(1200); // first poll -> still running -> reschedule
    expect(component.scanning).toBeTrue();

    jasmine.clock().tick(1200); // second poll -> completed
    expect(component.scanning).toBeFalse();
    expect(component.scanJob?.status).toBe('COMPLETED');
    expect(component.scanInfectedFindings.length).toBe(1);
    expect(component.scanNoThreats).toBeFalse();

    const callsSoFar = cloudMock.getScanJob.calls.count();
    jasmine.clock().tick(6000); // terminal: must not poll again
    expect(cloudMock.getScanJob.calls.count()).toBe(callsSoFar);
  });

  it('detects a disabled scanner (every file errored) with a clear message', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    cloudMock.getScanJob.and.returnValue(
      of({
        jobId: 'job-1',
        path: '',
        status: 'COMPLETED',
        filesScanned: 2,
        infectedCount: 0,
        findings: [
          {
            path: 'a.txt',
            verdict: 'ERROR',
            detail: 'virus scanning is disabled',
          },
          {
            path: 'b.txt',
            verdict: 'ERROR',
            detail: 'virus scanning is disabled',
          },
        ],
      }),
    );

    component.scanCurrentFolder();
    jasmine.clock().tick(1200);

    expect(component.scanScannerUnavailable).toBeTrue();
    expect(component.scanUnavailableMessage).toContain('turned off');
    expect(component.scanNoThreats).toBeFalse();
  });

  it('treats an unreachable scanner as unavailable (no "disabled" detail)', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    cloudMock.getScanJob.and.returnValue(
      of({
        jobId: 'job-1',
        path: '',
        status: 'COMPLETED',
        filesScanned: 1,
        infectedCount: 0,
        findings: [
          { path: 'a.txt', verdict: 'ERROR', detail: 'connection refused' },
        ],
      }),
    );

    component.scanCurrentFolder();
    jasmine.clock().tick(1200);

    expect(component.scanScannerUnavailable).toBeTrue();
    expect(component.scanUnavailableMessage).toContain('unavailable');
  });

  it('reports a clean scan as no threats', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    cloudMock.getScanJob.and.returnValue(
      of({
        jobId: 'job-1',
        path: '',
        status: 'COMPLETED',
        filesScanned: 4,
        infectedCount: 0,
        findings: [],
      }),
    );

    component.scanCurrentFolder();
    jasmine.clock().tick(1200);

    expect(component.scanNoThreats).toBeTrue();
    expect(component.scanScannerUnavailable).toBeFalse();
    expect(component.scanInfectedFindings.length).toBe(0);
  });

  it('surfaces a rate-limit (429) on start and never polls', () => {
    cloudMock.startFolderScan.and.returnValue(
      throwError(() => ({ status: 429 })),
    );

    component.scanCurrentFolder();

    expect(component.scanning).toBeFalse();
    expect(component.scanError).toContain('wait');
    jasmine.clock().tick(6000);
    expect(cloudMock.getScanJob).not.toHaveBeenCalled();
  });

  it('keeps the scan alive when polling is rate limited, and still completes', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    // throttled once, then the backend lets us through again
    cloudMock.getScanJob.and.returnValues(
      throwError(() => ({ status: 429 })),
      of({ ...runningJob, status: 'COMPLETED', findings: [] }),
    );

    component.scanCurrentFolder();
    jasmine.clock().tick(1200); // first poll -> 429

    // a throttled poll says nothing about the scan: it must not be reported as
    // failed, and the dialog must stay in its running state
    expect(component.scanning).toBeTrue();
    expect(component.scanError).toBeUndefined();

    jasmine.clock().tick(5000); // backoff elapses -> poll succeeds
    expect(component.scanning).toBeFalse();
    expect(component.scanError).toBeUndefined();
    expect(component.scanJob?.status).toBe('COMPLETED');
  });

  it('gives up on a persistently rate-limited scan without claiming it failed', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    cloudMock.getScanJob.and.returnValue(throwError(() => ({ status: 429 })));

    component.scanCurrentFolder();
    jasmine.clock().tick(1200); // first poll
    jasmine.clock().tick(5000 * 5); // exhaust the retries

    expect(component.scanning).toBeFalse();
    expect(component.scanError).toContain('may still be running');
    expect(cloudMock.getScanJob).toHaveBeenCalledTimes(6); // initial + 5 retries
  });

  it('handles an expired job (404) during polling', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    cloudMock.getScanJob.and.returnValue(throwError(() => ({ status: 404 })));

    component.scanCurrentFolder();
    jasmine.clock().tick(1200);

    expect(component.scanning).toBeFalse();
    expect(component.scanError).toContain('no longer available');
  });

  it('stops polling once the dialog is closed mid-scan', () => {
    cloudMock.startFolderScan.and.returnValue(of({ ...runningJob }));
    cloudMock.getScanJob.and.returnValue(of({ ...runningJob })); // never terminal

    component.scanCurrentFolder();
    jasmine.clock().tick(1200);
    const calls = cloudMock.getScanJob.calls.count();

    component.onScanDialogHide();
    jasmine.clock().tick(6000);

    expect(cloudMock.getScanJob.calls.count()).toBe(calls);
  });

  it('does not start polling if closed while the start request is in flight', () => {
    const start$ = new Subject<ScanJobDto>();
    cloudMock.startFolderScan.and.returnValue(start$.asObservable());
    cloudMock.getScanJob.and.returnValue(of({ ...runningJob }));

    component.scanCurrentFolder(); // POST in flight
    component.onScanDialogHide(); // user closes before it resolves
    start$.next({ ...runningJob }); // POST resolves late
    start$.complete();
    jasmine.clock().tick(6000);

    expect(cloudMock.getScanJob).not.toHaveBeenCalled();
  });
});

describe('CloudComponent File Checksum', () => {
  let component: CloudComponent;
  let cloudMock: jasmine.SpyObj<CloudService>;
  let toastMock: { success: jasmine.Spy; error: jasmine.Spy };

  beforeEach(() => {
    cloudMock = jasmine.createSpyObj<CloudService>('CloudService', [
      'getFileChecksum',
    ]);
    toastMock = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };
    component = new CloudComponent(
      cloudMock,
      {} as never,
      toastMock as never,
      {} as never,
      {} as never,
    );
    component.rootPath = '/root';
  });

  it('should open dialog and load file checksum successfully', () => {
    const mockChecksum = {
      filePath: 'test.pdf',
      checksum:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      algorithm: 'SHA-256',
    };
    cloudMock.getFileChecksum.and.returnValue(of(mockChecksum));

    component.openChecksumDialog({
      name: 'test.pdf',
      path: '/root/test.pdf',
    });

    expect(component.showChecksumDialog).toBeTrue();
    expect(component.selectedFileForChecksum?.name).toBe('test.pdf');
    expect(component.checksumLoading).toBeFalse();
    expect(component.checksumResult?.checksum).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('should handle checksum error and invoke toast notification', () => {
    cloudMock.getFileChecksum.and.returnValue(
      throwError(() => new Error('Checksum endpoint failure')),
    );

    component.openChecksumDialog({
      name: 'corrupted.zip',
      path: '/root/corrupted.zip',
    });

    expect(component.checksumLoading).toBeFalse();
    expect(component.checksumError).toContain('Checksum endpoint failure');
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('should evaluate expected hash comparison correctly', () => {
    component.checksumResult = {
      filePath: 'doc.txt',
      checksum: 'A1B2C3D4E5',
      algorithm: 'SHA-256',
    };

    component.expectedHash = '';
    expect(component.hashMatchStatus).toBe('empty');

    component.expectedHash = 'a1b2c3d4e5';
    expect(component.hashMatchStatus).toBe('match');

    component.expectedHash = 'wronghash123';
    expect(component.hashMatchStatus).toBe('mismatch');
  });

  it('should copy checksum to clipboard and set toast notification', () => {
    component.checksumResult = {
      filePath: 'doc.txt',
      checksum: '1234567890abcdef',
      algorithm: 'SHA-256',
    };

    component.copyChecksumToClipboard();

    expect(component.copiedHashState).toBeTrue();
    expect(toastMock.success).toHaveBeenCalledWith(
      'Checksum Copied',
      jasmine.any(String),
    );
  });
});
