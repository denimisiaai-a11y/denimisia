import { IsString } from 'class-validator';

export class CheckPermissionDto {
  @IsString()
  resource: string;

  @IsString()
  action: string;
}

export class AssignRoleDto {
  @IsString()
  userId: string;

  @IsString()
  role: string;
}
