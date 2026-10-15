import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '../entidades/rol.enum';
import { RolesGuard } from './roles.guard';

function contextFor(rol: Rol): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 1, rol } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: () => [Rol.ADMIN],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('permite ADMIN', () => {
    expect(guard.canActivate(contextFor(Rol.ADMIN))).toBe(true);
  });

  it('rechaza otros roles', () => {
    expect(() => guard.canActivate(contextFor(Rol.CONSULTOR))).toThrow(
      ForbiddenException,
    );
  });
});
