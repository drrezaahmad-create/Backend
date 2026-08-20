import { 
    IsEmail, 
    IsEnum, 
    IsOptional, 
    IsString, 
    MinLength, 
    Matches 
  } from 'class-validator';
  import { Role } from 'src/common/enum/user_role.enum';
  import { UserStatus } from 'src/common/enum/user.status.enum';
  
  export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    firstName?: string;
  
    @IsOptional()
    @IsString()
    @MinLength(2)
    lastName?: string;
  
    @IsOptional()
    @IsEmail()
    email?: string;
  
    @IsOptional()
    @IsString()
    @Matches(/^\+?[\d\s\-()]+$/, { message: 'Phone number is not valid' })
    phone?: string;
  
    @IsOptional()
    @IsString()
    imageUrl?: string;
  
    @IsOptional()
    @IsString()
    gdcNumber?: string;
  
    @IsOptional()
    @IsString()
    clinicName?: string;
  
    @IsOptional()
    @IsEnum(Role)
    role?: Role;
  
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;
  }