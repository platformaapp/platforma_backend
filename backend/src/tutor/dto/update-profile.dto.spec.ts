import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

describe('Tutor specializations', () => {
  it('accepts several free-form specializations', async () => {
    const dto = plainToInstance(UpdateProfileDto, { specialization: 'Авторское кино, Звуковой дизайн' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('preserves an empty string so all specializations can be removed', async () => {
    const dto = plainToInstance(UpdateProfileDto, { specialization: '' });
    expect(dto.specialization).toBe('');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects values exceeding the database column size', async () => {
    const dto = plainToInstance(UpdateProfileDto, { specialization: 'x'.repeat(256) });
    expect((await validate(dto)).some((error) => error.property === 'specialization')).toBe(true);
  });
});
