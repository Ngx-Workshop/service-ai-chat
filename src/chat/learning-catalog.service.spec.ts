import { ConfigService } from '@nestjs/config';
import { LearningCatalogService } from './learning-catalog.service';
describe('Public learning catalog boundary', () => {
  const id = '6acaffbb4d4ddb09fe84ff6d';
  const service = new LearningCatalogService(
    new ConfigService({
      DOCUMENT_BASE_URL: 'http://documents:3000/document',
      CODING_LABS_BASE_URL: 'http://labs:3009/coding-labs',
    })
  );
  afterEach(() => jest.restoreAllMocks());
  it('retrieves real section resources through the configured API', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            _id: id,
            sectionId: 'angular',
            name: 'Angular',
            summary: 'Learn',
            workshopDocuments: [],
          },
        ])
      )
    );
    expect(
      await service.workshops('angular', new AbortController().signal)
    ).toEqual([{ id, title: 'Angular', summary: 'Learn', outline: [] }]);
    expect((fetcher.mock.calls[0][0] as URL).href).toBe(
      'http://documents:3000/document/navigation/workshops?section=angular'
    );
    expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
  });
  it('rejects untrusted IDs before making an upstream request', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    await expect(
      service.lab('../../private', new AbortController().signal)
    ).rejects.toThrow('Invalid resource');
    await expect(
      service.workshops('https://elsewhere', new AbortController().signal)
    ).rejects.toThrow('Invalid section');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects mismatched section results', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ _id: id, sectionId: 'private', name: 'Other' }])
        )
      );
    await expect(
      service.workshops('angular', new AbortController().signal)
    ).rejects.toThrow('Invalid section result');
  });
});
