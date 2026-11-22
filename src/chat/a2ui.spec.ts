import { randomUUID } from 'node:crypto';
import { ChatService } from './chat.service';
import { ChatResponder } from './chat-responder';
import { ConversationRepository } from './conversation.repository';
import { MemoryRepository } from './testing/memory-repository';
import { LearningSurface, surfaceData } from './a2ui-builder';
import { LearningToolsService } from './learning-tools.service';
import { LearningCatalogService } from './learning-catalog.service';
import { ChatCommandDto } from './dto/chat.dto';

describe('A2UI learning actions', () => {
  let repository: MemoryRepository;
  let service: ChatService;
  beforeEach(() => {
    repository = new MemoryRepository();
    service = new ChatService(
      repository as unknown as ConversationRepository,
      new ChatResponder()
    );
  });
  afterEach(async () => service.onModuleDestroy());
  async function setup(kind: 'quiz' | 'progress' = 'quiz') {
    const builder = new LearningSurface('Practice');
    if (kind === 'quiz')
      builder.quiz('Choose', ['One', 'Two'], 1, 'Two is correct.');
    else builder.checklist([{ title: 'Learn DI', prompt: 'Explain DI' }]);
    const ui = builder.build();
    const conversation = await repository.create('alice', 'Learning');
    const messageId = randomUUID();
    conversation.messages.push({
      id: messageId,
      role: 'assistant',
      createdAt: '',
      status: 'completed',
      parts: [{ kind: 'a2ui', ui }],
    });
    await repository.save('alice', conversation);
    const command: ChatCommandDto = {
      type: 'ui_action',
      requestId: randomUUID(),
      conversationId: conversation.id,
      clientMessageId: randomUUID(),
      messageId,
      surfaceId: ui.surfaceId,
      uiRevision: 0,
      actionId: kind === 'quiz' ? 'check_answer' : 'save_progress',
      values: kind === 'quiz' ? { selection: ['1'] } : { step_0: true },
    };
    return { command, ui };
  }
  it('persists quiz feedback and rejects stale revisions and other owners', async () => {
    const { command } = await setup();
    await expect(service.uiAction('bob', command)).rejects.toThrow();
    const saved = await service.uiAction('alice', command);
    const ui = saved.messages[0].parts[0].ui!;
    expect(ui.revision).toBe(1);
    expect(surfaceData(ui)).toMatchObject({
      selection: ['1'],
      feedback: 'Correct! Two is correct.',
    });
    expect(
      (await repository.get('alice', saved.id)).messages[0].parts[0].ui
    ).toEqual(ui);
    await expect(service.uiAction('alice', command)).rejects.toThrow('changed');
  });
  it('rejects forged actions and invalid answer values without saving', async () => {
    const { command } = await setup();
    await expect(
      service.uiAction('alice', { ...command, actionId: 'run_code' })
    ).rejects.toThrow('Unknown');
    await expect(
      service.uiAction('alice', { ...command, values: { selection: ['999'] } })
    ).rejects.toThrow('Choose one');
    expect(
      (await repository.get('alice', command.conversationId)).messages[0]
        .parts[0].ui!.revision
    ).toBe(0);
  });
  it('saves checklist state and only accepts boolean values', async () => {
    const { command } = await setup('progress');
    await expect(
      service.uiAction('alice', { ...command, values: { step_0: 'true' } })
    ).rejects.toThrow('Invalid checklist');
    const saved = await service.uiAction('alice', command);
    expect(surfaceData(saved.messages[0].parts[0].ui!)).toMatchObject({
      step_0: true,
      feedback: 'Checklist saved: 1 of 1 steps complete.',
    });
  });
  it('uses server-stored prompts and preserves idempotent retries', async () => {
    const builder = new LearningSurface('Next');
    builder.followUp('Explain DI');
    const ui = builder.build();
    const c = await repository.create('alice', 'Next');
    const messageId = randomUUID();
    c.messages.push({
      id: messageId,
      role: 'assistant',
      createdAt: '',
      status: 'completed',
      parts: [{ kind: 'a2ui', ui }],
    });
    await repository.save('alice', c);
    const spy = jest.spyOn(service, 'send').mockResolvedValue(c);
    const command: ChatCommandDto = {
      type: 'ui_action',
      requestId: randomUUID(),
      conversationId: c.id,
      clientMessageId: randomUUID(),
      messageId,
      surfaceId: ui.surfaceId,
      uiRevision: 0,
      actionId: 'action0',
      values: { prompt: 'forged' },
    };
    await service.uiAction('alice', command);
    expect(spy).toHaveBeenCalledWith(
      'alice',
      c.id,
      command.clientMessageId,
      'Explain DI'
    );
  });
  it('validates model tool arguments before producing a surface', async () => {
    const tools = new LearningToolsService({} as LearningCatalogService);
    await expect(
      tools.execute(
        'create_practice_quiz',
        {
          title: 'Test',
          question: '?',
          choices: ['A', 'B'],
          correctIndex: 2,
          explanation: 'X',
        },
        new AbortController().signal
      )
    ).rejects.toThrow();
    await expect(
      tools.execute(
        'create_learning_plan',
        {
          title: 'Test',
          summary: 'Plan',
          steps: Array(7).fill({ title: 'Step', prompt: 'Help' }),
        },
        new AbortController().signal
      )
    ).rejects.toThrow();
  });
  it('bounds persisted interactive history before accepting another run', async () => {
    const c = await repository.create('alice', 'Large learning history');
    for (let i = 0; i < 12; i++) {
      const builder = new LearningSurface('History');
      for (let j = 0; j < 8; j++) builder.text('x'.repeat(5900));
      c.messages.push({
        id: randomUUID(),
        role: 'assistant',
        status: 'completed',
        createdAt: '',
        parts: [{ kind: 'a2ui', ui: builder.build() }],
      });
    }
    await repository.save('alice', c);
    await expect(
      service.send('alice', c.id, randomUUID(), 'Continue')
    ).rejects.toThrow('Start a new conversation');
    expect((await repository.get('alice', c.id)).activeRunId).toBeUndefined();
  });
});
