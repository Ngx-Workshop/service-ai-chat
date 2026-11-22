import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class A2uiActionDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['prompt', 'navigate', 'quiz', 'progress'] }) type:
    | 'prompt'
    | 'navigate'
    | 'quiz'
    | 'progress';
  @ApiProperty() label: string;
  @ApiPropertyOptional() prompt?: string;
  @ApiPropertyOptional() path?: string;
  @ApiPropertyOptional() answer?: string;
  @ApiPropertyOptional() explanation?: string;
  @ApiPropertyOptional({ type: [String] }) fields?: string[];
}
export class A2uiSurfaceDto {
  @ApiProperty({ enum: ['1.0'] }) version: '1.0';
  @ApiProperty() surfaceId: string;
  @ApiProperty() revision: number;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  messages: Record<string, unknown>[];
  @ApiProperty({ type: [A2uiActionDto] }) actions: A2uiActionDto[];
  @ApiProperty() fallback: string;
}
