// dto/add-emails.dto.ts
import { ArrayNotEmpty, IsArray, IsEmail, IsString } from 'class-validator';

export class AddEmailsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];
}

// dto/add-phones.dto.ts


export class AddPhonesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  phones: string[];
}

// dto/remove-many.dto.ts (optional, for bulk remove)


export class RemoveManyDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  items: string[]; // emails or phones depending on route
}
