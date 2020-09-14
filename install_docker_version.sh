# install docker and compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install python3-pip
sudo pip3 install docker-compose

# if postgres is running
sudo service postgresql stop
sudo systemctl disable postgresql.service

# get app
git clone https://gitlab.pidario.nsupdate.info/dario/surfjudge-pyramid.git

# install app
cd surfjudge-pyramid
sudo docker-compose build
sudo docker-compose up -d
