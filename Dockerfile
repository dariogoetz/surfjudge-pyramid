FROM python:latest

ADD app /app

EXPOSE 80

VOLUME /app/surfjudge

WORKDIR /app

# python setup.py develop generates an .egg-info file in the current directory
# if the surfjudge directory will be mounted from external, that .egg-info file
# is not available anymore and the surfjudge-pyramid package therefore not installed
# we install from the global python (3.7) directory therefore
##RUN cd /usr/local/lib/python3.7/site-packages && python /surfjudge/setup.py develop

#RUN python3 setup.py install
RUN python3 setup.py develop

ENV PYTHONPATH=.

#CMD ["pserve", "development.ini", "--reload"]
CMD ["gunicorn", "--paste", "production.ini"]