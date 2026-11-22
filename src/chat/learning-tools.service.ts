import { Injectable } from '@nestjs/common';
import { LearningSurface, label } from './a2ui-builder';
import { LearningCatalogService } from './learning-catalog.service';
import { ChatPartDto } from './dto/chat.dto';
const string = { type: 'string' };
export const LEARNING_TOOLS = [
  {
    name: 'create_learning_plan',
    description:
      'Show an interactive learning checklist with follow-up buttons. Use for a learning plan or practice roadmap.',
    parameters: {
      type: 'object',
      properties: {
        title: string,
        summary: string,
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'object',
            properties: { title: string, prompt: string },
            required: ['title', 'prompt'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'summary', 'steps'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_practice_quiz',
    description:
      'Show one informal multiple-choice practice question with interactive answer feedback. This is not a graded assessment.',
    parameters: {
      type: 'object',
      properties: {
        title: string,
        question: string,
        choices: { type: 'array', items: string, minItems: 2, maxItems: 5 },
        correctIndex: { type: 'integer', minimum: 0, maximum: 4 },
        explanation: string,
      },
      required: ['title', 'question', 'choices', 'correctIndex', 'explanation'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_workshops',
    description:
      'Retrieve real public workshop recommendations in a section and show interactive cards. Use actual section IDs such as angular, typescript, javascript, nestjs or rxjs. Do not guess workshop IDs.',
    parameters: {
      type: 'object',
      properties: { sectionId: string },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'show_workshop',
    description:
      'Retrieve a real workshop and its learning outline, with cards for published coding labs. Requires an ID returned by find_workshops.',
    parameters: {
      type: 'object',
      properties: { sectionId: string, workshopId: string },
      required: ['sectionId', 'workshopId'],
      additionalProperties: false,
    },
  },
  {
    name: 'show_coding_lab',
    description:
      'Retrieve a published lab by a real ID supplied by the learner or workshop outline. Show its prompt and follow-up hint buttons. Never invent IDs.',
    parameters: {
      type: 'object',
      properties: { labId: string },
      required: ['labId'],
      additionalProperties: false,
    },
  },
].map((tool) => ({ type: 'function', ...tool, strict: false }));
@Injectable()
export class LearningToolsService {
  constructor(private readonly catalog: LearningCatalogService) {}
  async execute(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<ChatPartDto> {
    let ui: LearningSurface;
    if (name === 'create_learning_plan') {
      ui = new LearningSurface(label(args['title'], 200));
      ui.text(label(args['summary'], 2000));
      const steps = args['steps'];
      if (!Array.isArray(steps) || steps.length < 1 || steps.length > 6)
        throw new Error('Invalid steps');
      ui.checklist(
        steps.map((step: unknown) => {
          const row = this.object(step);
          return {
            title: label(row['title'], 300),
            prompt: label(row['prompt'], 1000),
          };
        })
      );
    } else if (name === 'create_practice_quiz') {
      const choices = args['choices'];
      const index = args['correctIndex'];
      if (
        !Array.isArray(choices) ||
        choices.length < 2 ||
        choices.length > 5 ||
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= choices.length
      )
        throw new Error('Invalid question');
      ui = new LearningSurface(label(args['title'], 200));
      ui.quiz(
        label(args['question'], 2000),
        choices.map((value) => label(value, 500)),
        index,
        label(args['explanation'], 3000)
      );
      ui.followUp(
        'Give me another practice question on this topic.',
        'Try another question'
      );
    } else if (name === 'find_workshops' || name === 'show_workshop') {
      const section = label(args['sectionId'], 120);
      const workshops = await this.catalog.workshops(section, signal);
      const selected =
        name === 'show_workshop'
          ? workshops.filter((item) => item.id === args['workshopId'])
          : workshops.slice(0, 5);
      if (name === 'show_workshop' && !selected.length)
        throw new Error('Workshop not found');
      ui = new LearningSurface(
        name === 'show_workshop'
          ? selected[0].title
          : `Explore ${section} workshops`
      );
      if (!selected.length)
        ui.text('No published workshops were found in this section.');
      selected.forEach((item) => {
        ui.card(item.title, item.summary, {
          id: `open_${item.id}`,
          type: 'navigate',
          label: 'Open workshop',
          path: `/workshops/overview?workshop=${item.id}`,
        });
        if (name === 'show_workshop')
          item.outline.slice(0, 8).forEach((entry) => {
            ui!.text(entry.title);
            if (
              entry.kind === 'CODING_LAB' &&
              /^[a-f0-9]{24}$/i.test(entry.resourceId)
            )
              ui!.followUp(
                `Show coding lab ${entry.resourceId}.`,
                'Preview this coding lab'
              );
          });
        else
          ui!.followUp(
            `Show the outline for workshop ${item.id} in section ${section}.`,
            'Preview learning outline'
          );
      });
    } else if (name === 'show_coding_lab') {
      const lab = await this.catalog.lab(label(args['labId'], 24), signal);
      ui = new LearningSurface(lab.title);
      ui.text(`${lab.language} · Published version ${lab.version}`);
      ui.text(lab.prompt.slice(0, 5500));
      lab.hints.forEach((hint, index) =>
        ui!.followUp(
          `Explain hint ${index + 1} for coding lab ${lab.id}: ${hint.slice(0, 700)}`,
          `Explore hint ${index + 1}`
        )
      );
      ui.followUp(
        `Help me reason about coding lab ${lab.id} without giving the complete solution.`,
        'Help me get started'
      );
    } else throw new Error('Unsupported learning tool');
    return { kind: 'a2ui', ui: ui.build() };
  }
  private object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid input');
    return value as Record<string, unknown>;
  }
}
