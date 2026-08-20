// contact-info.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ContactInfo, ContactInfoDocument } from './contact-info.schema';
import { Model } from 'mongoose';

@Injectable()
export class ContactInfoService {
  constructor(
    @InjectModel(ContactInfo.name)
    private contactModel: Model<ContactInfoDocument>,
  ) {}

  private async getOrCreate(): Promise<ContactInfoDocument> {
    // Find existing or create one (singleton)
    const doc = await this.contactModel.findOne();
    if (doc) return doc;
    return this.contactModel.create({});
  }

  async getContactInfo() {
    return this.getOrCreate();
  }

  async updateContactInfo(data: Partial<ContactInfo>) {
    const contact = await this.getOrCreate();
    Object.assign(contact, data);
    return contact.save();
  }

  // ---- single-item ops (kept for backward compatibility)
  async addEmail(email: string) {
    await this.contactModel.updateOne(
      {},
      { $addToSet: { emails: email } },
      { upsert: true },
    );
    return this.getOrCreate();
  }

  async removeEmail(email: string) {
    await this.contactModel.updateOne({}, { $pull: { emails: email } });
  }

  async addPhone(phone: string) {
    await this.contactModel.updateOne(
      {},
      { $addToSet: { phone } },
      { upsert: true },
    );
    return this.getOrCreate();
  }

  async removePhone(phone: string) {
    await this.contactModel.updateOne({}, { $pull: { phone } });
  }

  // ---- bulk ops
  async addEmails(emails: string[]) {
    // $addToSet with $each ensures dedupe + atomicity
    await this.contactModel.updateOne(
      {},
      { $addToSet: { emails: { $each: emails } } },
      { upsert: true },
    );
    return this.getOrCreate();
  }

  async addPhones(phones: string[]) {
    await this.contactModel.updateOne(
      {},
      { $addToSet: { phone: { $each: phones } } },
      { upsert: true },
    );
    return this.getOrCreate();
  }

  async removeEmails(emails: string[]) {
    await this.contactModel.updateOne(
      {},
      { $pull: { emails: { $in: emails } } },
    );
  }

  async removePhones(phones: string[]) {
    await this.contactModel.updateOne(
      {},
      { $pull: { phone: { $in: phones } } },
    );
  }
}
