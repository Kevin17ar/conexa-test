import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';


import { StartWarApiService } from '../start-war-api/services/start-war-api.service';
import { MoviesService } from '../movies/services/movies.service';
import { UtilsService } from '../utils/services/utils.service';
import { CreateMovieDto } from '../movies/dto';
import { config } from '../config';

@Injectable()
export class TaskService implements OnModuleInit {
    private readonly logger = new Logger(TaskService.name);

    constructor(
        @Inject(config.KEY)
        private readonly configuration: ConfigType<typeof config>,
        private readonly startWarApiService: StartWarApiService,
        private readonly moviesService: MoviesService,
        private readonly utilsService: UtilsService,
        private readonly schedulerRegistry: SchedulerRegistry
    ) { }

    async onModuleInit() {
        const cronTime = this.configuration.params.cronTask;
        const job = new CronJob(cronTime, () => {
            this.handleCron();
        });

        this.schedulerRegistry.addCronJob(cronTime, job);
        job.start();
    }

    async handleCron() {
        try {
            const respose = await this.startWarApiService.getAllFilms();
            const filmsStartWars = respose.results;

            for (const film of filmsStartWars) {
                const existingMovie = await this.moviesService.findOne({ title: film.title });
                if (existingMovie) {
                    existingMovie.director = film.director;
                    existingMovie.producer = film.producer;
                    existingMovie.releaseDate = this.utilsService.formatDate(new Date(film.release_date));

                    await this.moviesService.save(existingMovie);
                } else {
                    const createMovieDto: CreateMovieDto = {
                        title: film.title,
                        director: film.director,
                        producer: film.producer,
                        releaseDate: this.utilsService.formatDate(new Date(film.release_date))
                    };

                    await this.moviesService.createMovie(createMovieDto)
                }
            }

            this.logger.log('Movies processed successfully');
        } catch (error) {
            this.logger.error('Error fetching data from external API:', error);
        }
    };
}
