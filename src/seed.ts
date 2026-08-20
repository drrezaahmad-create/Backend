import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './modules/users/schema/user.schema';
import { Role } from './common/enum/user_role.enum';
import { UserStatus } from './common/enum/user.status.enum';
import * as bcrypt from 'bcrypt';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const existingAdmin = await userModel.findOne({ email: adminEmail });

  if (existingAdmin) {
    console.log(`\n⚠️ User with email "${adminEmail}" already exists.`);
    existingAdmin.role = Role.ADMIN;
    existingAdmin.status = UserStatus.APPROVED;
    existingAdmin.isVerified = true;
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    existingAdmin.password = hashedPassword;
    await existingAdmin.save();
    console.log(`✅ User updated to Super Admin successfully!`);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await userModel.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
      status: UserStatus.APPROVED,
      isVerified: true,
    });
    console.log(`✅ Super Admin created successfully!`);
  }

  console.log(`\n🔑 Super Admin Credentials:`);
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Role: ${Role.ADMIN}`);
  console.log(`   Status: ${UserStatus.APPROVED}\n`);

  await app.close();
}

seedAdmin().catch((err) => {
  console.error('❌ Failed to seed admin:', err);
  process.exit(1);
});
