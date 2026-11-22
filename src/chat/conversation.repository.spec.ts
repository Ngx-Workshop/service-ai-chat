import { Model } from 'mongoose';
import { ConversationRepository } from './conversation.repository';
import { ChatConversation } from './schemas/conversation.schema';

describe('Conversation persistence boundaries', () => {
  it('scopes reads and compare-and-swap writes to both identity and revision', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const query = { lean: () => ({ exec }) };
    const model = {
      findOne: jest.fn<typeof query, [unknown]>().mockReturnValue(query),
      findOneAndUpdate: jest
        .fn<typeof query, [unknown, unknown, unknown]>()
        .mockReturnValue(query),
    };
    const repository = new ConversationRepository(
      model as unknown as Model<ChatConversation>
    );
    await expect(repository.get('alice', 'conversation')).rejects.toThrow(
      'not found'
    );
    expect(model.findOne).toHaveBeenCalledWith({
      _id: 'conversation',
      ownerId: 'alice',
    });
    await expect(
      repository.save('bob', {
        id: 'conversation',
        revision: 3,
        title: 'test',
        updatedAt: '',
        messages: [],
      })
    ).rejects.toThrow('changed');
    expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: 'conversation',
      ownerId: 'bob',
      revision: 3,
    });
    expect(model.findOneAndUpdate.mock.calls[0][1]).toMatchObject({
      $inc: { revision: 1 },
      $unset: { activeRunId: 1 },
    });
  });
});
