import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Dental Backend API is running! Access API endpoints at /api';
  }

  getDashboard(): string {
    return 'Hello World! I am Dashboard';
  }
}
